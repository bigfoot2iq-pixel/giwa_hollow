import pkg from "hardhat";
const { ethers, run } = pkg;

// ── Constructor arguments ──────────────────────────────────────────
const HOLLOW_TOKEN_NAME = "Hollow Token";
const HOLLOW_TOKEN_SYMBOL = "HOLLOW";
const INITIAL_CLAIM_COOLDOWN = 86_400;
const WATCHDOG_ADDRESS = process.env.WATCHDOG_ADDRESS;

const CATEGORIES = [
  { name: "Bronze", amount: ethers.parseEther("50"), fee: ethers.parseEther("0.0001") },
  { name: "Silver", amount: ethers.parseEther("100"), fee: ethers.parseEther("0.0005") },
  { name: "Gold", amount: ethers.parseEther("200"), fee: ethers.parseEther("0.001") },
  { name: "Platinum", amount: ethers.parseEther("500"), fee: ethers.parseEther("0.005") },
];

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
  console.log("  GIWA Sepolia Deployment (HollowToken + Raffles)");
  console.log("═══════════════════════════════════════════════════");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("Watchdog:", watchdog, watchdog === deployer.address ? "(defaulted to deployer)" : "");
  console.log("");

  // ── 1. Deploy HollowToken ───────────────────────────────────────
  console.log("Deploying HollowToken...");
  const HollowToken = await ethers.getContractFactory("HollowToken");
  const hollowToken = await HollowToken.deploy(
    HOLLOW_TOKEN_NAME,
    HOLLOW_TOKEN_SYMBOL,
    INITIAL_CLAIM_COOLDOWN,
  );
  await hollowToken.waitForDeployment();
  const hollowAddress = await hollowToken.getAddress();
  console.log(`✅ HollowToken deployed to: ${hollowAddress}`);

  console.log("Setting categories...");
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = CATEGORIES[i];
    console.log(`  Setting category ${i}: ${c.name}...`);
    await (await hollowToken.setCategory(i, c.name, c.amount, c.fee)).wait();
  }
  console.log("✅ Categories set.");

  // ── 2. Deploy RobinhoodRaffles ─────────────────────────────────────
  console.log("\nDeploying RobinhoodRaffles...");
  const RobinhoodRaffles = await ethers.getContractFactory("RobinhoodRaffles");
  const robinhoodRaffles = await RobinhoodRaffles.deploy(
    hollowAddress,
    watchdog,
  );
  await robinhoodRaffles.waitForDeployment();
  const rafflesAddress = await robinhoodRaffles.getAddress();
  console.log(`✅ RobinhoodRaffles deployed to: ${rafflesAddress}`);

  // ── 3. Wait for block explorer to index ─────────────────────────
  console.log("\nWaiting 30s for explorer to index the contracts...");
  await new Promise((resolve) => setTimeout(resolve, 30_000));

  // ── 4. Verify ───────────────────────────────────────────────────
  await verifyContract(hollowAddress, [
    HOLLOW_TOKEN_NAME,
    HOLLOW_TOKEN_SYMBOL,
    INITIAL_CLAIM_COOLDOWN,
  ]);
  await verifyContract(rafflesAddress, [hollowAddress, watchdog]);

  // ── Summary ─────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Deployment Complete!");
  console.log("═══════════════════════════════════════════════════");
  console.log(`HollowToken:   ${hollowAddress}`);
  console.log(`RobinhoodRaffles: ${rafflesAddress}`);
  console.log(`\nUpdate your .env.local:`);
  console.log(`NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS=${hollowAddress}`);
  console.log(`NEXT_PUBLIC_RAFFLES_CONTRACT_ADDRESS=${rafflesAddress}`);
  console.log(`\nGIWA Explorer:`);
  console.log(`https://sepolia-explorer.giwa.io/address/${hollowAddress}#code`);
  console.log(`https://sepolia-explorer.giwa.io/address/${rafflesAddress}#code`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
