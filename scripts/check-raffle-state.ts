import { createPublicClient, http } from "viem";
import { contracts, giwaSepolia, RobinhoodRafflesABI } from "../lib/contracts/config";

/**
 * Script to check the on-chain state of a raffle
 * Usage: npx tsx scripts/check-raffle-state.ts <chainRaffleId>
 */

const RAFFLE_STATES = ["CREATED", "ACTIVE", "COMPLETED", "CANCELLED"];

async function checkRaffleState(chainRaffleId: number) {
  const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rpc.giwa.io";
  
  const client = createPublicClient({
    chain: giwaSepolia,
    transport: http(rpcUrl),
  });

  console.log(`\n🔍 Checking raffle #${chainRaffleId} on contract ${contracts.raffles.address}\n`);

  try {
    const result = await client.readContract({
      address: contracts.raffles.address,
      abi: RobinhoodRafflesABI,
      functionName: "raffles",
      args: [BigInt(chainRaffleId)],
    }) as [number, string, number, bigint, boolean, boolean];

    const [prizeType, prizeToken, state, prizeCount, isNFT, hasWinners] = result;

    console.log("📊 Raffle Details:");
    console.log("─────────────────────────────────────");
    console.log(`Prize Type:    ${prizeType} (${isNFT ? "NFT" : "Token"})`);
    console.log(`Prize Token:   ${prizeToken}`);
    console.log(`Prize Count:   ${prizeCount.toString()}`);
    console.log(`State:         ${state} (${RAFFLE_STATES[state]})`);
    console.log(`Has Winners:   ${hasWinners}`);
    console.log("─────────────────────────────────────\n");

    if (state === 0) {
      console.log("⚠️  WARNING: Raffle is in CREATED state!");
      console.log("   Users cannot join until it's activated.\n");
      console.log("   To fix: Call activateRaffle(" + chainRaffleId + ") from owner/watchdog wallet\n");
    } else if (state === 1) {
      console.log("✅ Raffle is ACTIVE - users can join\n");
    } else if (state === 2) {
      console.log("🏁 Raffle is COMPLETED\n");
    } else if (state === 3) {
      console.log("❌ Raffle is CANCELLED\n");
    }

    // Check if raffle is active
    const isActive = await client.readContract({
      address: contracts.raffles.address,
      abi: RobinhoodRafflesABI,
      functionName: "isRaffleActive",
      args: [BigInt(chainRaffleId)],
    });

    console.log(`isRaffleActive(): ${isActive}\n`);

  } catch (error) {
    console.error("❌ Error checking raffle:", error);
  }
}

const chainRaffleId = process.argv[2];
if (!chainRaffleId) {
  console.error("Usage: npx tsx scripts/check-raffle-state.ts <chainRaffleId>");
  process.exit(1);
}

checkRaffleState(parseInt(chainRaffleId));
