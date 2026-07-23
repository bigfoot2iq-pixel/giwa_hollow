import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdminSignature } from "@/lib/utils/auth";
import { RobinhoodRafflesABI, contracts, giwaSepolia } from "@/lib/contracts";
import { getOnChainRaffleMeta, ZERO_ADDRESS } from "@/lib/utils/chain";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  isAddress,
  parseAbi,
  parseEventLogs,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

const isUintString = (value: string) => /^\d+$/.test(value);
const dateStringSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid datetime" });
const erc20Abi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
]);

const erc721Abi = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function approve(address to, uint256 tokenId)",
  "function setApprovalForAll(address operator, bool approved)",
]);

const prizeSchema = z
  .object({
    prize_type: z.enum(["erc20", "erc721", "erc6220"]),
    prize_token_address: z
      .string()
      .refine((value) => isAddress(value, { strict: false }), { message: "Invalid address" }),
    prize_amount: z.string().optional().nullable(),
    prize_token_id: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.prize_type === "erc20") {
      if (!data.prize_amount || !isUintString(data.prize_amount)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["prize_amount"],
          message: "Prize amount is required for ERC20",
        });
      }
      if (data.prize_token_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["prize_token_id"],
          message: "Prize token ID is not valid for ERC20",
        });
      }
    } else {
      if (!data.prize_token_id || !isUintString(data.prize_token_id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["prize_token_id"],
          message: "Token ID is required for NFT prizes",
        });
      }
      if (data.prize_amount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["prize_amount"],
          message: "Prize amount is not valid for NFT prizes",
        });
      }
    }
  });

const createRaffleSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().optional(),
  description: z.string().min(1),
  image_url: z.string().url().optional().nullable(),
  tokens_required: z.number().positive(),
  max_entries_per_user: z.number().int().positive(),
  max_participants: z.number().positive(),
  start_date: dateStringSchema,
  end_date: dateStringSchema,
  prizes: z.array(prizeSchema).min(1),
});

// Helper function to generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')  // Remove special characters
    .replace(/\s+/g, '_');         // Replace spaces with underscores
}

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSignature(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);

    // scope splits platform (owner) raffles from community (user-created) raffles.
    // Creator is on-chain truth: address(0) = platform, otherwise community. Because the
    // creator isn't a DB column, every row is fetched and partitioned/paginated in-app.
    const scope = searchParams.get("scope") as "platform" | "community" | null;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const { data, error } = await supabase
      .from("litvm_raffle_raffles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching raffles:", error);
      return NextResponse.json({ error: "Failed to fetch raffles" }, { status: 500 });
    }

    // Get stats
    const { data: stats } = await supabase.rpc("litvm_raffle_get_admin_stats");

    // Read on-chain meta (state + creator) for every deployed raffle, then partition by scope.
    const chainMeta = await getOnChainRaffleMeta(
      (data || [])
        .filter((r) => r.chain_raffle_id)
        .map((r) => ({ dbId: r.id, chainId: r.chain_raffle_id! }))
    );

    const isCommunity = (raffleId: string) => {
      const creator = chainMeta.get(raffleId)?.creator;
      return !!creator && creator.toLowerCase() !== ZERO_ADDRESS;
    };

    const filteredRows = (data || []).filter((raffle) => {
      if (scope === "platform") return !isCommunity(raffle.id);
      if (scope === "community") return isCommunity(raffle.id);
      return true;
    });

    const total = filteredRows.length;
    const pageRows = filteredRows.slice(offset, offset + limit);

    const raffleIds = pageRows.map((raffle) => raffle.id);
    const participantsByRaffle = new Map<string, number>();
    const prizeTypesByRaffle = new Map<string, string[]>();

    if (raffleIds.length > 0) {
      const { data: entries, error: entriesError } = await supabase
        .from("litvm_raffle_entries")
        .select("raffle_id")
        .in("raffle_id", raffleIds);

      if (entriesError) {
        console.error("Error fetching raffle participants:", entriesError);
      } else {
        entries?.forEach((entry) => {
          participantsByRaffle.set(
            entry.raffle_id,
            (participantsByRaffle.get(entry.raffle_id) || 0) + 1
          );
        });
      }
    }

    if (raffleIds.length > 0) {
      const { data: prizes, error: prizesError } = await supabase
        .from("litvm_raffle_prizes")
        .select("raffle_id, prize_type")
        .in("raffle_id", raffleIds);

      if (prizesError) {
        console.error("Error fetching raffle prizes:", prizesError);
      } else {
        prizes?.forEach((prize) => {
          const existing = prizeTypesByRaffle.get(prize.raffle_id) || [];
          existing.push(prize.prize_type);
          prizeTypesByRaffle.set(prize.raffle_id, existing);
        });
      }
    }

    const raffles = pageRows.map((raffle) => ({
      ...raffle,
      participants_count: participantsByRaffle.get(raffle.id) || 0,
      prize_types: Array.from(new Set(prizeTypesByRaffle.get(raffle.id) || [])),
      status: chainMeta.get(raffle.id)?.status || "pending",
      is_community: isCommunity(raffle.id),
    }));

    return NextResponse.json({
      raffles,
      total,
      limit,
      offset,
      stats,
    });
  } catch (error) {
    console.error("Error in GET /api/admin/raffles:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminSignature(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createRaffleSchema.safeParse(body);

    if (!validation.success) {
      console.error("Invalid raffle create payload", {
        issues: validation.error.issues,
        body,
      });
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error.issues },
        { status: 400 }
      );
    }

    const data = validation.data;
    const adminWallet = request.headers.get("x-admin-wallet");
    if (!adminWallet || !isAddress(adminWallet)) {
      return NextResponse.json({ error: "Invalid admin wallet" }, { status: 400 });
    }

    // Validate dates
    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);
    
    if (endDate <= startDate) {
      console.error("Invalid raffle dates", {
        start_date: data.start_date,
        end_date: data.end_date,
      });
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
    }

    const prizeType = data.prizes[0].prize_type;
    const normalizedPrizeAddresses = data.prizes.map((prize) =>
      getAddress(prize.prize_token_address.toLowerCase() as `0x${string}`)
    );
    const prizeTokenAddress = normalizedPrizeAddresses[0];
    const hasMixedPrizeType = data.prizes.some((prize) => prize.prize_type !== prizeType);
    const hasMixedTokenAddress = normalizedPrizeAddresses.some((address) => address !== prizeTokenAddress);

    if (hasMixedPrizeType || hasMixedTokenAddress) {
      console.error("Mixed prize configuration", {
        prizeType,
        prizeTokenAddress,
        prizes: data.prizes,
      });
      return NextResponse.json(
        { error: "All prizes must share the same type and token address" },
        { status: 400 }
      );
    }

    const raffleContract = contracts.raffles.address;
    if (!raffleContract) {
      console.error("Missing raffle contract configuration");
      return NextResponse.json(
        { error: "Missing contract configuration" },
        { status: 500 }
      );
    }

    const rpcUrl =
      process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rpc.giwa.io";
    const publicClient = createPublicClient({
      chain: giwaSepolia,
      transport: http(rpcUrl),
    });

    const prizeAmounts =
      prizeType === "erc20"
        ? data.prizes.map((prize) => BigInt(prize.prize_amount!))
        : [];
    const prizeTokenIds =
      prizeType === "erc20"
        ? []
        : data.prizes.map((prize) => BigInt(prize.prize_token_id!));
    const totalPrizeAmount =
      prizeType === "erc20" ? prizeAmounts.reduce((total, amount) => total + amount, 0n) : 0n;
    const prizeTypeEnum = prizeType === "erc20" ? 0 : prizeType === "erc721" ? 1 : 2;
    const shouldActivate = startDate <= new Date();

    // Validate prize token contract
    const bytecode = await publicClient.getBytecode({ address: prizeTokenAddress });
    if (!bytecode || bytecode === "0x") {
      console.error("Invalid prize token contract", { prizeTokenAddress });
      return NextResponse.json(
        { error: "Prize token address is not a contract" },
        { status: 400 }
      );
    }

    if (prizeType === "erc20" && totalPrizeAmount > 0n) {
      // Verify admin has sufficient balance
      let balance: bigint;
      try {
        balance = await publicClient.readContract({
          address: prizeTokenAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [adminWallet as `0x${string}`],
        });
      } catch (error) {
        console.error("Invalid ERC20 prize token", { prizeTokenAddress, error });
        return NextResponse.json(
          { error: "Prize token address is not a valid ERC20 contract" },
          { status: 400 }
        );
      }
      if (balance < totalPrizeAmount) {
        console.error("Insufficient prize token balance", {
          address: adminWallet,
          balance: balance.toString(),
          required: totalPrizeAmount.toString(),
        });
        return NextResponse.json(
          { error: "Admin has insufficient prize token balance" },
          { status: 400 }
        );
      }

      // Check allowance
      const allowance = await publicClient.readContract({
        address: prizeTokenAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [adminWallet as `0x${string}`, raffleContract],
      });
      if (allowance < totalPrizeAmount) {
        return NextResponse.json(
          {
            error: "Insufficient allowance",
            details: {
              message: "Please approve the raffle contract to spend your tokens",
              requiredApproval: totalPrizeAmount.toString(),
              currentAllowance: allowance.toString(),
              spender: raffleContract,
            },
          },
          { status: 400 }
        );
      }
    } else if (prizeType !== "erc20") {
      // For NFTs, check if admin owns the tokens and has approved the contract
      for (const tokenId of prizeTokenIds) {
        try {
          const owner = await publicClient.readContract({
            address: prizeTokenAddress,
            abi: erc721Abi,
            functionName: "ownerOf",
            args: [tokenId],
          });

          if (owner.toLowerCase() !== adminWallet.toLowerCase()) {
            return NextResponse.json(
              {
                error: "NFT not owned by admin",
                details: {
                  message: `Token ID ${tokenId} is not owned by your wallet`,
                  tokenId: tokenId.toString(),
                  owner,
                  adminWallet,
                },
              },
              { status: 400 }
            );
          }

          // Check if approved
          const isApprovedForAll = await publicClient.readContract({
            address: prizeTokenAddress,
            abi: erc721Abi,
            functionName: "isApprovedForAll",
            args: [adminWallet as `0x${string}`, raffleContract],
          });

          if (!isApprovedForAll) {
            const approved = await publicClient.readContract({
              address: prizeTokenAddress,
              abi: erc721Abi,
              functionName: "getApproved",
              args: [tokenId],
            });

            if (approved.toLowerCase() !== raffleContract.toLowerCase()) {
              return NextResponse.json(
                {
                  error: "NFT not approved",
                  details: {
                    message: "Please approve the raffle contract to transfer your NFTs. Use setApprovalForAll or approve each token individually.",
                    tokenId: tokenId.toString(),
                    operator: raffleContract,
                  },
                },
                { status: 400 }
              );
            }
          }
        } catch (error) {
          console.error("Error checking NFT ownership/approval", { tokenId, error });
          return NextResponse.json(
            {
              error: "Failed to verify NFT",
              details: {
                message: `Could not verify token ID ${tokenId}. Make sure it exists and the contract is a valid ERC721.`,
                tokenId: tokenId.toString(),
              },
            },
            { status: 400 }
          );
        }
      }
    }

    // Return transaction data for admin to sign
    const functionName = (
      prizeType === "erc20"
        ? shouldActivate
          ? "createAndActivateTokenRaffle"
          : "createRaffleWithToken"
        : shouldActivate
        ? "createAndActivateNFTRaffle"
        : "createRaffleWithNFT"
    ) as
      | "createAndActivateTokenRaffle"
      | "createRaffleWithToken"
      | "createAndActivateNFTRaffle"
      | "createRaffleWithNFT";
    
    // Convert BigInt values to strings for JSON serialization
    const serializableArgs = (
      prizeType === "erc20"
        ? [prizeTokenAddress as `0x${string}`, prizeAmounts.map(a => a.toString())]
        : [prizeTypeEnum, prizeTokenAddress as `0x${string}`, prizeTokenIds.map(id => id.toString())]
    );

    // Generate slug for the response (will be auto-generated by DB on insert)
    const slug = data.slug || generateSlug(data.title);

    return NextResponse.json({
      requiresTransaction: true,
      transaction: {
        to: raffleContract,
        functionName,
        args: serializableArgs,
        prizeType,
        prizeTokenAddress,
      },
      raffleData: {
        ...data,
        slug,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/admin/raffles:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
