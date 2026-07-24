import pkg from "hardhat";
const { ethers, run } = pkg;

const ARIWA_TOKEN_NAME = "ARIWA";
const ARIWA_TOKEN_SYMBOL = "ARIWA";
const INITIAL_CLAIM_AMOUNT = ethers.parseEther("1"); // 1 ARIWA per claim
const INITIAL_CLAIM_FEE = 0n; // free by default; admin can raise
const INITIAL_CLAIM_COOLDOWN = 43_200; // 12 hours

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("═══════════════════════════════════════════════════");
  console.log("  AriwaToken Deployment (GIWA Sepolia)");
  console.log("═══════════════════════════════════════════════════");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("Claim Amount:", ethers.formatEther(INITIAL_CLAIM_AMOUNT), "ARIWA");
  console.log("Claim Fee:", ethers.formatEther(INITIAL_CLAIM_FEE), "ETH");
  console.log("Claim Cooldown:", INITIAL_CLAIM_COOLDOWN, "seconds");
  console.log("");

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
  console.log(`AriwaToken deployed to: ${ariwaAddress}`);

  console.log("\nWaiting 30s for explorer to index the contract...");
  await new Promise((resolve) => setTimeout(resolve, 30_000));

  console.log(`\nVerifying ${ariwaAddress} on GIWA Explorer...`);
  try {
    await run("verify:verify", {
      address: ariwaAddress,
      constructorArguments: [
        ARIWA_TOKEN_NAME,
        ARIWA_TOKEN_SYMBOL,
        INITIAL_CLAIM_AMOUNT,
        INITIAL_CLAIM_FEE,
        INITIAL_CLAIM_COOLDOWN,
      ],
    });
    console.log(`${ariwaAddress} verified successfully!`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("already verified")) {
      console.log(`${ariwaAddress} is already verified.`);
    } else {
      console.error(`Verification failed for ${ariwaAddress}:`, msg);
    }
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Deployment Complete!");
  console.log("═══════════════════════════════════════════════════");
  console.log(`AriwaToken: ${ariwaAddress}`);
  console.log(`\nUpdate your .env.local:`);
  console.log(`NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS=${ariwaAddress}`);
  console.log(`\nGIWA Explorer:`);
  console.log(`https://sepolia-explorer.giwa.io/address/${ariwaAddress}#code`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
