import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdminSignature } from "@/lib/utils/auth";
import { RobinhoodRafflesABI, giwaSepolia } from "@/lib/contracts";
import { createPublicClient, getAddress, http, isAddress, parseEventLogs } from "viem";
import { z } from "zod";

// Unique per raffle: the on-chain id is appended, and chain_raffle_id is a UNIQUE
// column, so no two raffles can ever collide — even with identical titles. The
// admin path previously left slug unset and let the DB trigger derive it from the
// title alone, so a second "Ariwa" raffle hit litvm_raffle_raffles_slug_key AFTER
// its prize was already escrowed on-chain. Mirrors slugify() in
// app/api/raffles/create/route.ts.
function slugify(title: string, chainRaffleId: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "raffle"}-${chainRaffleId}`;
}

const confirmRaffleSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash"),
  raffleData: z.object({
    title: z.string(),
    description: z.string(),
    image_url: z.string().nullable(),
    tokens_required: z.number(),
    max_entries_per_user: z.number(),
    max_participants: z.number(),
    start_date: z.string(),
    end_date: z.string(),
    prizes: z.array(z.object({
      prize_type: z.enum(["erc20", "erc721", "erc6220"]),
      prize_token_address: z.string(),
      prize_amount: z.string().nullable(),
      prize_token_id: z.string().nullable(),
    })),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSignature(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = confirmRaffleSchema.safeParse(body);

    if (!validation.success) {
      console.error("Invalid raffle confirm payload", {
        issues: validation.error.issues,
        body,
      });
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { txHash, raffleData } = validation.data;

    const rpcUrl =
      process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rpc.giwa.io";
    const publicClient = createPublicClient({
      chain: giwaSepolia,
      transport: http(rpcUrl),
    });

    console.log("Waiting for raffle create tx", { txHash });
    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash: txHash as `0x${string}`,
      timeout: 60_000, // 60 seconds
    });
    console.log("Raffle create tx mined", { txHash, status: receipt.status });

    if (receipt.status !== "success") {
      return NextResponse.json(
        { error: "Transaction failed" },
        { status: 400 }
      );
    }

    const raffleEvents = parseEventLogs({
      abi: RobinhoodRafflesABI,
      logs: receipt.logs,
      eventName: "RaffleCreated",
    });
    const raffleEvent = raffleEvents[0] as { args?: { raffleId?: bigint } } | undefined;
    const raffleIdFromEvent = raffleEvent?.args?.raffleId;
    if (raffleIdFromEvent === undefined) {
      console.error("Missing RaffleCreated event", { txHash });
      return NextResponse.json(
        { error: "Failed to read raffle id from transaction" },
        { status: 500 }
      );
    }

    const chainRaffleId = Number(raffleIdFromEvent);
    const supabase = await createServiceClient();

    // Check if this chain_raffle_id already exists
    const { data: existingRaffle } = await supabase
      .from("litvm_raffle_raffles")
      .select("id, chain_raffle_id, tx_hash")
      .eq("chain_raffle_id", chainRaffleId)
      .single();

    if (existingRaffle) {
      // If the same txHash created this record, treat as idempotent success (retry-safe)
      if (existingRaffle.tx_hash === txHash) {
        console.log("Idempotent confirm: raffle already exists for this txHash", {
          chainRaffleId,
          existingRaffleId: existingRaffle.id,
          txHash,
        });
        return NextResponse.json({ raffle: existingRaffle }, { status: 200 });
      }

      console.error("Raffle with this chain_raffle_id already exists", {
        chainRaffleId,
        existingRaffleId: existingRaffle.id,
        txHash,
      });
      return NextResponse.json(
        {
          error: "Raffle already exists in database",
          details: {
            chainRaffleId,
            existingRaffleId: existingRaffle.id,
            message: "This on-chain raffle ID is already registered.",
          },
        },
        { status: 409 }
      );
    }

    const prizeTokenAddress = getAddress(raffleData.prizes[0].prize_token_address.toLowerCase() as `0x${string}`);

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
      console.error("Error creating raffle:", error);
      return NextResponse.json({ error: "Failed to create raffle" }, { status: 500 });
    }

    const prizeInserts = raffleData.prizes.map((prize) => ({
      raffle_id: raffle.id,
      prize_type: prize.prize_type,
      prize_token_address: prizeTokenAddress,
      prize_amount: prize.prize_amount ?? null,
      prize_token_id: prize.prize_token_id ?? null,
    }));

    const { error: prizeError } = await supabase
      .from("litvm_raffle_prizes")
      .insert(prizeInserts);

    if (prizeError) {
      console.error("Error creating prizes:", prizeError);
      await supabase.from("litvm_raffle_raffles").delete().eq("id", raffle.id);
      return NextResponse.json({ error: "Failed to create prizes" }, { status: 500 });
    }

    // Log admin action
    const adminWallet = request.headers.get("x-admin-wallet") || "unknown";
    await supabase.from("litvm_raffle_admin_logs").insert({
      admin_wallet: adminWallet,
      action: "create_raffle",
      details: { raffle_id: raffle.id, title: raffle.title },
    });

    return NextResponse.json({ raffle }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/admin/raffles/confirm:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
