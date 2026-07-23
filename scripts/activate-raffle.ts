import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { contracts, giwaSepolia, RobinhoodRafflesABI } from "../lib/contracts/config";

/**
 * Script to activate a raffle that's in CREATED state
 * Usage: npx tsx scripts/activate-raffle.ts <chainRaffleId>
 * 
 * Requires WATCHDOG_PRIVATE_KEY or ADMIN_PRIVATE_KEY in .env.local
 */

async function activateRaffle(chainRaffleId: number) {
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

  console.log(`\n🔧 Activating raffle #${chainRaffleId}`);
  console.log(`   Contract: ${contracts.raffles.address}`);
  console.log(`   From: ${account.address}\n`);

  try {
    // Check current state
    const result = await publicClient.readContract({
      address: contracts.raffles.address,
      abi: RobinhoodRafflesABI,
      functionName: "raffles",
      args: [BigInt(chainRaffleId)],
    }) as [number, string, number, bigint, boolean, boolean];

    const state = result[2];
    
    if (state !== 0) {
      console.log(`⚠️  Raffle is not in CREATED state (current state: ${state})`);
      console.log("   No action needed.\n");
      return;
    }

    console.log("📝 Sending activateRaffle transaction...");

    const hash = await walletClient.writeContract({
      address: contracts.raffles.address,
      abi: RobinhoodRafflesABI,
      functionName: "activateRaffle",
      args: [BigInt(chainRaffleId)],
    });

    console.log(`   Transaction hash: ${hash}`);
    console.log("   Waiting for confirmation...\n");

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "success") {
      console.log("✅ Raffle activated successfully!");
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas used: ${receipt.gasUsed.toString()}\n`);
      
      // Verify new state
      const newResult = await publicClient.readContract({
        address: contracts.raffles.address,
        abi: RobinhoodRafflesABI,
        functionName: "raffles",
        args: [BigInt(chainRaffleId)],
      }) as [number, string, number, bigint, boolean, boolean];

      const newState = newResult[2];
      console.log(`   New state: ${newState} (${newState === 1 ? "ACTIVE" : "UNKNOWN"})\n`);
    } else {
      console.log("❌ Transaction failed\n");
    }

  } catch (error: any) {
    console.error("❌ Error activating raffle:", error.message || error);
  }
}

const chainRaffleId = process.argv[2];
if (!chainRaffleId) {
  console.error("Usage: npx tsx scripts/activate-raffle.ts <chainRaffleId>");
  process.exit(1);
}

activateRaffle(parseInt(chainRaffleId));
