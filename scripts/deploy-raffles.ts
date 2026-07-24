import pkg from "hardhat";
const { ethers, run } = pkg;

// Pulled from .env.local. ARIWA_TOKEN_ADDRESS must be a deployed AriwaToken
// on the target network; WATCHDOG_ADDRESS is the address allowed to end raffles.
const ARIWA_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS;
const WATCHDOG_ADDRESS = process.env.WATCHDOG_ADDRESS;

async function main() {
  if (!ARIWA_TOKEN_ADDRESS || !ethers.isAddress(ARIWA_TOKEN_ADDRESS)) {
    throw new Error("Set NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS in .env.local to the deployed AriwaToken address");
  }
  if (!WATCHDOG_ADDRESS || !ethers.isAddress(WATCHDOG_ADDRESS)) {
    throw new Error("Set WATCHDOG_ADDRESS in .env.local to the watchdog wallet address");
  }

  const [deployer] = await ethers.getSigners();
  console.log("═══════════════════════════════════════════════════");
  console.log("  RobinhoodRaffles Deployment (GIWA Sepolia)");
  console.log("═══════════════════════════════════════════════════");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("AriwaToken:", ARIWA_TOKEN_ADDRESS);
  console.log("Watchdog:", WATCHDOG_ADDRESS);
  console.log("");

  // Deploy RobinhoodRaffles
  console.log("Deploying AriwaRaffles...");
  const RobinhoodRaffles = await ethers.getContractFactory("AriwaRaffles");
  const robinhoodRaffles = await RobinhoodRaffles.deploy(
    ARIWA_TOKEN_ADDRESS,
    WATCHDOG_ADDRESS,
  );
  await robinhoodRaffles.waitForDeployment();
  const rafflesAddress = await robinhoodRaffles.getAddress();
  console.log(`✅ RobinhoodRaffles deployed to: ${rafflesAddress}`);

  // Wait for explorer to index
  console.log("\nWaiting 30s for explorer to index...");
  await new Promise((resolve) => setTimeout(resolve, 30_000));

  // Verify
  console.log(`\nVerifying ${rafflesAddress} on GIWA Explorer...`);
  try {
    await run("verify:verify", {
      address: rafflesAddress,
      constructorArguments: [ARIWA_TOKEN_ADDRESS, WATCHDOG_ADDRESS],
    });
    console.log(`✅ RobinhoodRaffles verified!`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("already verified")) {
      console.log(`✅ RobinhoodRaffles is already verified.`);
    } else {
      console.error(`❌ Verification failed:`, msg);
    }
  }

  // Summary
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Deployment Complete!");
  console.log("═══════════════════════════════════════════════════");
  console.log(`RobinhoodRaffles: ${rafflesAddress}`);
  console.log(`\nUpdate your .env.local:`);
  console.log(`NEXT_PUBLIC_RAFFLES_CONTRACT_ADDRESS=${rafflesAddress}`);
  console.log(`\nGIWA Explorer:`);
  console.log(`https://sepolia-explorer.giwa.io/address/${rafflesAddress}#code`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
