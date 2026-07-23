import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyAdminSignature } from "@/lib/utils/auth";
import { RobinhoodRafflesABI, contracts, giwaSepolia } from "@/lib/contracts";
import { createPublicClient, createWalletClient, getAddress, http, parseEventLogs } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await verifyAdminSignature(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createServiceClient();

    // Check if id is a UUID or a slug
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(id);

    let raffleQuery = supabase
      .from("litvm_raffle_raffles")
      .select("*");

    if (isUuid) {
      raffleQuery = raffleQuery.eq("id", id);
    } else {
      raffleQuery = raffleQuery.eq("slug", id.toLowerCase());
    }

    const { data: raffle, error: raffleError } = await raffleQuery.single();

    if (raffleError || !raffle) {
      return NextResponse.json({ error: "Raffle not found" }, { status: 404 });
    }

    if (!raffle.chain_raffle_id) {
      return NextResponse.json({ error: "Raffle not deployed on chain" }, { status: 400 });
    }

    // Get all entries for this raffle
    const { data: entries, error: entriesError } = await supabase
      .from("litvm_raffle_entries")
      .select("wallet_address, tokens_spent")
      .eq("raffle_id", raffle.id);

    if (entriesError) {
      return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
    }

    // Aggregate entries by wallet
    const participantMap = new Map<string, bigint>();
    (entries || []).forEach((entry) => {
      const normalized = getAddress(entry.wallet_address.toLowerCase() as `0x${string}`);
      const current = participantMap.get(normalized) || 0n;
      participantMap.set(normalized, current + BigInt(entry.tokens_spent));
    });

    const participants = Array.from(participantMap.keys()) as `0x${string}`[];
    const ticketCounts = Array.from(participantMap.values());

    // Setup blockchain clients
    const raffleContract = contracts.raffles.address;
    const privateKey = process.env.WATCHDOG_PRIVATE_KEY;
    if (!raffleContract || !privateKey) {
      return NextResponse.json({ error: "Missing contract configuration" }, { status: 500 });
    }

    const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rpc.giwa.io";
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const publicClient = createPublicClient({
      chain: giwaSepolia,
      transport: http(rpcUrl),
    });
    const walletClient = createWalletClient({
      chain: giwaSepolia,
      transport: http(rpcUrl),
      account,
    });

    // Generate random seed
    const randomSeed = BigInt(`0x${randomBytes(32).toString("hex")}`);

    // End raffle on chain
    const txHash = await walletClient.writeContract({
      address: raffleContract,
      abi: RobinhoodRafflesABI,
      functionName: "endRaffle",
      args: [BigInt(raffle.chain_raffle_id), participants, ticketCounts, randomSeed],
    });

    console.log("Raffle end tx sent", { txHash, raffleId: id, participantCount: participants.length });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log("Raffle end tx mined", { txHash, status: receipt.status });

    if (receipt.status !== "success") {
      return NextResponse.json({ error: "Transaction failed" }, { status: 500 });
    }

    // Parse winners from events
    const raffleEndedEvents = parseEventLogs({
      abi: RobinhoodRafflesABI,
      logs: receipt.logs,
      eventName: "RaffleEnded",
    });

    console.log("RaffleEnded events found:", raffleEndedEvents.length);

    const winners: string[] = [];
    if (raffleEndedEvents.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const event = raffleEndedEvents[0] as any;
      const args = event.args as { winners?: readonly string[]; totalParticipants?: bigint; totalTickets?: bigint };
      console.log("RaffleEnded args:", JSON.stringify(args, (_, v) => typeof v === "bigint" ? v.toString() : v));
      if (args?.winners) {
        winners.push(...args.winners);
      }
    }

    console.log("Winners parsed:", winners);

    // Store winners in database
    if (winners.length > 0) {
      const { data: prizes } = await supabase
        .from("litvm_raffle_prizes")
        .select("*")
        .eq("raffle_id", raffle.id)
        .order("created_at", { ascending: true });

      const winnerInserts = winners.map((winner, index) => ({
        raffle_id: raffle.id,
        wallet_address: winner.toLowerCase(),
        prize_amount: prizes?.[index]?.prize_amount || null,
        prize_token_id: prizes?.[index]?.prize_token_id || null,
        distribution_tx_hash: txHash,
      }));

      console.log("Inserting winners:", winnerInserts);

      const { error: winnerError } = await supabase.from("litvm_raffle_winners").insert(winnerInserts);
      if (winnerError) {
        console.error("Error inserting winners:", winnerError);
      }
    }

    // Log admin action
    const adminWallet = request.headers.get("x-admin-wallet") || "unknown";
    await supabase.from("litvm_raffle_admin_logs").insert({
      admin_wallet: adminWallet,
      action: "end_raffle",
      details: { 
        raffle_id: id, 
        tx_hash: txHash, 
        participant_count: participants.length,
        winner_count: winners.length 
      },
    });

    return NextResponse.json({ 
      success: true, 
      txHash, 
      winners,
      participantCount: participants.length 
    });
  } catch (error) {
    console.error("Error in POST /api/admin/raffles/[id]/end:", error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}
