import pkg from "hardhat";
const { ethers, run } = pkg;

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
  console.log("═══════════════════════════════════════════════════");
  console.log("  TheHollowGame Deployment (GIWA Sepolia)");
  console.log("═══════════════════════════════════════════════════");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("");

  // ── 1. Deploy TheHollowGame ───────────────────────────────────────
  console.log("Deploying TheHollowGame...");
  const TheHollowGame = await ethers.getContractFactory("TheHollowGame");
  const game = await TheHollowGame.deploy();
  await game.waitForDeployment();
  const gameAddress = await game.getAddress();
  console.log(`✅ TheHollowGame deployed to: ${gameAddress}`);

  // ── 2. Wait for block explorer to index ─────────────────────────
  console.log("\nWaiting 30s for explorer to index the contract...");
  await new Promise((resolve) => setTimeout(resolve, 30_000));

  // ── 3. Verify TheHollowGame ─────────────────────────────────────
  await verifyContract(gameAddress, []);

  // ── Summary ─────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Deployment Complete!");
  console.log("═══════════════════════════════════════════════════");
  console.log(`TheHollowGame: ${gameAddress}`);
  console.log(`\nUpdate your .env.local:`);
  console.log(`NEXT_PUBLIC_GAME_CONTRACT_ADDRESS=${gameAddress}`);
  console.log(`\nGIWA Explorer:`);
  console.log(`https://sepolia-explorer.giwa.io/address/${gameAddress}#code`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
