import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { RobinhoodRafflesABI, giwaSepolia, contracts } from "@/lib/contracts";
import { createPublicClient, getAddress, http, parseEventLogs } from "viem";
import { z } from "zod";

// Public endpoint: registers DB metadata for a raffle a user created on-chain via
// `createRaffleByUser`. No admin auth — instead we bind the metadata to the on-chain
// raffle by verifying the tx sender is the raffle's `creator` (see getRaffleSchedule).

const prizeSchema = z
  .object({
    prize_type: z.enum(["erc20", "erc721", "erc6220"]),
    prize_token_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    prize_amount: z.string().regex(/^\d+$/).nullable().optional(),
    prize_token_id: z.string().regex(/^\d+$/).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.prize_type === "erc20") {
      if (!data.prize_amount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["prize_amount"],
          message: "Prize amount is required for ERC20",
        });
      }
    } else if (!data.prize_token_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["prize_token_id"],
        message: "Token ID is required for NFT prizes",
      });
    }
  });

const createRaffleSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash"),
  creatorWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet"),
  raffleData: z.object({
    title: z.string().min(1).max(255),
    description: z.string().min(1),
    image_url: z.string().url().nullable(),
    tokens_required: z.number().positive(),
    max_entries_per_user: z.number().int().positive(),
    max_participants: z.number().positive(),
    start_date: z.string(),
    end_date: z.string(),
    prizes: z.array(prizeSchema).min(1),
  }),
});

function slugify(title: string, chainRaffleId: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "raffle"}-${chainRaffleId}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createRaffleSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { txHash, creatorWallet, raffleData } = validation.data;

    const rpcUrl =
      process.env.RPC_URL ||
      process.env.NEXT_PUBLIC_RPC_URL ||
      "https://sepolia-rpc.giwa.io";
    const publicClient = createPublicClient({
      chain: giwaSepolia,
      transport: http(rpcUrl),
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      timeout: 60_000,
    });

    if (receipt.status !== "success") {
      return NextResponse.json({ error: "Transaction failed" }, { status: 400 });
    }

    // The on-chain raffle id comes from the RaffleCreated event (emitted by
    // createRaffleByUser via the shared token-raffle path).
    const raffleEvents = parseEventLogs({
      abi: RobinhoodRafflesABI,
      logs: receipt.logs,
      eventName: "RaffleCreated",
    });
    const raffleIdFromEvent = (raffleEvents[0] as { args?: { raffleId?: bigint } } | undefined)
      ?.args?.raffleId;
    if (raffleIdFromEvent === undefined) {
      return NextResponse.json(
        { error: "Failed to read raffle id from transaction" },
        { status: 500 }
      );
    }
    const chainRaffleId = Number(raffleIdFromEvent);

    // Security: confirm this is genuinely the caller's user raffle. getRaffleSchedule
    // returns the on-chain creator; it must match the claimed wallet. This blocks
    // registering metadata against admin raffles (creator == 0) or someone else's raffle.
    const [onChainCreator] = (await publicClient.readContract({
      address: contracts.raffles.address,
      abi: RobinhoodRafflesABI,
      functionName: "getRaffleSchedule",
      args: [BigInt(chainRaffleId)],
    })) as [string, bigint];

    if (getAddress(onChainCreator) !== getAddress(creatorWallet)) {
      return NextResponse.json(
        { error: "Raffle creator does not match caller" },
        { status: 403 }
      );
    }

    // All prize slots must share one type + token address (the contract escrows a
    // single prize collection per raffle).
    const prizeType = raffleData.prizes[0].prize_type;
    const prizeTokenAddress = getAddress(raffleData.prizes[0].prize_token_address as `0x${string}`);
    const mixed = raffleData.prizes.some(
      (p) =>
        p.prize_type !== prizeType ||
        getAddress(p.prize_token_address as `0x${string}`) !== prizeTokenAddress
    );
    if (mixed) {
      return NextResponse.json(
        { error: "All prizes must share the same type and token address" },
        { status: 400 }
      );
    }

    // Security: confirm the claimed prize type matches what was escrowed on-chain so
    // NFT metadata can't be registered against a token raffle (or vice versa).
    const info = (await publicClient.readContract({
      address: contracts.raffles.address,
      abi: RobinhoodRafflesABI,
      functionName: "getRaffleInfo",
      args: [BigInt(chainRaffleId)],
    })) as readonly [number, string, bigint, number, boolean, boolean];
    const onChainIsNFT = info[4];
    const claimedIsNFT = prizeType !== "erc20";
    if (onChainIsNFT !== claimedIsNFT) {
      return NextResponse.json(
        { error: "Prize type does not match on-chain raffle" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Idempotency: a raffle for this chain id may already be registered (retry-safe).
    const { data: existingRaffle } = await supabase
      .from("litvm_raffle_raffles")
      .select("id, chain_raffle_id, tx_hash")
      .eq("chain_raffle_id", chainRaffleId)
      .single();

    if (existingRaffle) {
      if (existingRaffle.tx_hash === txHash) {
        return NextResponse.json({ raffle: existingRaffle }, { status: 200 });
      }
      return NextResponse.json(
        { error: "Raffle already exists in database" },
        { status: 409 }
      );
    }

    const { data: raffle, error } = await supabase
      .from("litvm_raffle_raffles")
      .insert({
        title: raffleData.title,
        slug: slugify(raffleData.title, chainRaffleId),
        description: raffleData.description,
        image_url: raffleData.image_url,
        tokens_required: raffleData.tokens_required,
        max_entries_per_user: raffleData.max_entries_per_user,
        max_participants: raffleData.max_participants,
        start_date: raffleData.start_date,
        end_date: raffleData.end_date,
        chain_raffle_id: chainRaffleId,
        tx_hash: txHash,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating user raffle:", error);
      return NextResponse.json({ error: "Failed to create raffle" }, { status: 500 });
    }

    const prizeInserts = raffleData.prizes.map((prize) => ({
      raffle_id: raffle.id,
      prize_type: prize.prize_type,
      prize_token_address: prizeTokenAddress,
      prize_amount: prize.prize_type === "erc20" ? prize.prize_amount : null,
      prize_token_id: prize.prize_type === "erc20" ? null : prize.prize_token_id,
    }));

    const { error: prizeError } = await supabase
      .from("litvm_raffle_prizes")
      .insert(prizeInserts);

    if (prizeError) {
      console.error("Error creating prizes:", prizeError);
      await supabase.from("litvm_raffle_raffles").delete().eq("id", raffle.id);
      return NextResponse.json({ error: "Failed to create prizes" }, { status: 500 });
    }

    return NextResponse.json({ raffle }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/raffles/create:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
