import { createWalletClient, createPublicClient, http, getAddress, parseEventLogs } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "crypto";
import { contracts, giwaSepolia, RobinhoodRafflesABI } from "../lib/contracts/config";

/**
 * Script to end a raffle on-chain with custom participants
 * Usage: npx tsx scripts/end-raffle.ts <chainRaffleId>
 *
 * Configure PARTICIPANTS below before running.
 * Requires WATCHDOG_PRIVATE_KEY or ADMIN_PRIVATE_KEY in .env.local
 */

// =============================================
// CUSTOMIZE PARTICIPANTS HERE
// Each entry: { address, tickets }
// =============================================
const PARTICIPANTS: { address: string; tickets: number }[] = [
  // { address: "0x1234...abcd", tickets: 10 },
  // { address: "0x5678...efgh", tickets: 5 },
];

async function endRaffle(chainRaffleId: number) {
  if (PARTICIPANTS.length === 0) {
    console.error("❌ No participants configured. Edit the PARTICIPANTS array in the script.");
    process.exit(1);
  }

  const privateKey = process.env.WATCHDOG_PRIVATE_KEY || process.env.ADMIN_PRIVATE_KEY;

  if (!privateKey) {
    console.error("❌ Error: WATCHDOG_PRIVATE_KEY or ADMIN_PRIVATE_KEY not found in environment");
    process.exit(1);
  }

  const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rpc.giwa.io";

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const publicClient = createPublicClient({
    chain: giwaSepolia,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: giwaSepolia,
    transport: http(rpcUrl),
  });

  const participants = PARTICIPANTS.map((p) => getAddress(p.address as `0x${string}`));
  const ticketCounts = PARTICIPANTS.map((p) => BigInt(p.tickets));
  const randomSeed = BigInt(`0x${randomBytes(32).toString("hex")}`);

  console.log(`\n🎲 Ending raffle #${chainRaffleId}`);
  console.log(`   Contract: ${contracts.raffles.address}`);
  console.log(`   From: ${account.address}`);
  console.log(`   Participants: ${participants.length}`);
  console.log(`   Total tickets: ${ticketCounts.reduce((a, b) => a + b, 0n).toString()}`);
  console.log();

  // Log each participant
  PARTICIPANTS.forEach((p, i) => {
    console.log(`   [${i + 1}] ${participants[i]} - ${p.tickets} tickets`);
  });
  console.log();

  try {
    // Check current state
    const result = await publicClient.readContract({
      address: contracts.raffles.address,
      abi: RobinhoodRafflesABI,
      functionName: "raffles",
      args: [BigInt(chainRaffleId)],
    }) as [number, string, number, bigint, boolean, boolean];

    const state = result[2];
    console.log(`   Current on-chain state: ${state}`);

    if (state !== 1) {
      console.log(`⚠️  Raffle is not in ACTIVE state (state: ${state}). Proceeding anyway...\n`);
    }

    console.log("📝 Sending endRaffle transaction...");

    const hash = await walletClient.writeContract({
      address: contracts.raffles.address,
      abi: RobinhoodRafflesABI,
      functionName: "endRaffle",
      args: [BigInt(chainRaffleId), participants, ticketCounts, randomSeed],
    });

    console.log(`   Transaction hash: ${hash}`);
    console.log("   Waiting for confirmation...\n");

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "success") {
      console.log("✅ Raffle ended successfully!");
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas used: ${receipt.gasUsed.toString()}\n`);

      // Parse winners from events
      const raffleEndedEvents = parseEventLogs({
        abi: RobinhoodRafflesABI,
        logs: receipt.logs,
        eventName: "RaffleEnded",
      });

      if (raffleEndedEvents.length > 0) {
        const event = raffleEndedEvents[0] as any;
        const args = event.args as { winners?: readonly string[]; totalParticipants?: bigint; totalTickets?: bigint };

        if (args?.winners && args.winners.length > 0) {
          console.log(`🏆 Winners (${args.winners.length}):`);
          args.winners.forEach((w, i) => {
            console.log(`   [${i + 1}] ${w}`);
          });
        } else {
          console.log("⚠️  No winners found in event");
        }

        if (args?.totalParticipants) {
          console.log(`\n   Total participants: ${args.totalParticipants.toString()}`);
        }
        if (args?.totalTickets) {
          console.log(`   Total tickets: ${args.totalTickets.toString()}`);
        }
      } else {
        console.log("⚠️  No RaffleEnded event found in receipt");
      }

      console.log();
    } else {
      console.log("❌ Transaction failed\n");
    }
  } catch (error: any) {
    console.error("❌ Error ending raffle:", error.message || error);
  }
}

const chainRaffleId = process.argv[2];
if (!chainRaffleId) {
  console.error("Usage: npx tsx scripts/end-raffle.ts <chainRaffleId>");
  process.exit(1);
}

endRaffle(parseInt(chainRaffleId));
