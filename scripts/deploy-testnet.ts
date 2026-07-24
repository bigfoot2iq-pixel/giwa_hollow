import pkg from "hardhat";
const { ethers, run } = pkg;

// ── Constructor arguments ──────────────────────────────────────────
const ARIWA_TOKEN_NAME = "ARIWA";
const ARIWA_TOKEN_SYMBOL = "ARIWA";
const INITIAL_CLAIM_AMOUNT = ethers.parseEther("1"); // 1 ARIWA per claim
const INITIAL_CLAIM_FEE = 0n; // free by default; admin can raise
const INITIAL_CLAIM_COOLDOWN = 43_200; // 12 hours
const WATCHDOG_ADDRESS = process.env.WATCHDOG_ADDRESS;

async function verifyContract(address: string, constructorArguments: unknown[]) {
  console.log(`\nVerifying ${address} on GIWA Explorer...`);
  try {
    await run("verify:verify", {
      address,
      constructorArguments,
    });
    console.log(`✅ ${address} verified successfully!`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("already verified")) {
      console.log(`✅ ${address} is already verified.`);
    } else {
      console.error(`❌ Verification failed for ${address}:`, msg);
    }
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const watchdog = WATCHDOG_ADDRESS && ethers.isAddress(WATCHDOG_ADDRESS)
    ? WATCHDOG_ADDRESS
    : deployer.address;

  console.log("═══════════════════════════════════════════════════");
  console.log("  GIWA Sepolia Deployment (AriwaToken + Raffles)");
  console.log("═══════════════════════════════════════════════════");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("Watchdog:", watchdog, watchdog === deployer.address ? "(defaulted to deployer)" : "");
  console.log("");

  // ── 1. Deploy AriwaToken ───────────────────────────────────────
  console.log("Deploying AriwaToken...");
  const AriwaToken = await ethers.getContractFactory("AriwaToken");
  const ariwaToken = await AriwaToken.deploy(
    ARIWA_TOKEN_NAME,
    ARIWA_TOKEN_SYMBOL,
    INITIAL_CLAIM_AMOUNT,
    INITIAL_CLAIM_FEE,
    INITIAL_CLAIM_COOLDOWN,
  );
  await ariwaToken.waitForDeployment();
  const ariwaAddress = await ariwaToken.getAddress();
  console.log(`✅ AriwaToken deployed to: ${ariwaAddress}`);

  // ── 2. Deploy AriwaRaffles ─────────────────────────────────────
  console.log("\nDeploying AriwaRaffles...");
  const RobinhoodRaffles = await ethers.getContractFactory("AriwaRaffles");
  const robinhoodRaffles = await RobinhoodRaffles.deploy(
    ariwaAddress,
    watchdog,
  );
  await robinhoodRaffles.waitForDeployment();
  const rafflesAddress = await robinhoodRaffles.getAddress();
  console.log(`✅ RobinhoodRaffles deployed to: ${rafflesAddress}`);

  // ── 3. Wait for block explorer to index ─────────────────────────
  console.log("\nWaiting 30s for explorer to index the contracts...");
  await new Promise((resolve) => setTimeout(resolve, 30_000));

  // ── 4. Verify ───────────────────────────────────────────────────
  await verifyContract(ariwaAddress, [
    ARIWA_TOKEN_NAME,
    ARIWA_TOKEN_SYMBOL,
    INITIAL_CLAIM_AMOUNT,
    INITIAL_CLAIM_FEE,
    INITIAL_CLAIM_COOLDOWN,
  ]);
  await verifyContract(rafflesAddress, [ariwaAddress, watchdog]);

  // ── Summary ─────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Deployment Complete!");
  console.log("═══════════════════════════════════════════════════");
  console.log(`AriwaToken:   ${ariwaAddress}`);
  console.log(`RobinhoodRaffles: ${rafflesAddress}`);
  console.log(`\nUpdate your .env.local:`);
  console.log(`NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS=${ariwaAddress}`);
  console.log(`NEXT_PUBLIC_RAFFLES_CONTRACT_ADDRESS=${rafflesAddress}`);
  console.log(`\nGIWA Explorer:`);
  console.log(`https://sepolia-explorer.giwa.io/address/${ariwaAddress}#code`);
  console.log(`https://sepolia-explorer.giwa.io/address/${rafflesAddress}#code`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
