import pkg from "hardhat";
const { ethers, run } = pkg;

const HOLLOW_TOKEN_NAME = "The Hollow";
const HOLLOW_TOKEN_SYMBOL = "HOLLOW";
const INITIAL_CLAIM_AMOUNT = ethers.parseEther("1"); // 1 HOLLOW per claim
const INITIAL_CLAIM_FEE = 0n; // free by default; admin can raise
const INITIAL_CLAIM_COOLDOWN = 43_200; // 12 hours

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("═══════════════════════════════════════════════════");
  console.log("  HollowToken Deployment (GIWA Sepolia)");
  console.log("═══════════════════════════════════════════════════");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("Claim Amount:", ethers.formatEther(INITIAL_CLAIM_AMOUNT), "HOLLOW");
  console.log("Claim Fee:", ethers.formatEther(INITIAL_CLAIM_FEE), "ETH");
  console.log("Claim Cooldown:", INITIAL_CLAIM_COOLDOWN, "seconds");
  console.log("");

  console.log("Deploying HollowToken...");
  const HollowToken = await ethers.getContractFactory("HollowToken");
  const hollowToken = await HollowToken.deploy(
    HOLLOW_TOKEN_NAME,
    HOLLOW_TOKEN_SYMBOL,
    INITIAL_CLAIM_AMOUNT,
    INITIAL_CLAIM_FEE,
    INITIAL_CLAIM_COOLDOWN,
  );
  await hollowToken.waitForDeployment();
  const hollowAddress = await hollowToken.getAddress();
  console.log(`HollowToken deployed to: ${hollowAddress}`);

  console.log("\nWaiting 30s for explorer to index the contract...");
  await new Promise((resolve) => setTimeout(resolve, 30_000));

  console.log(`\nVerifying ${hollowAddress} on GIWA Explorer...`);
  try {
    await run("verify:verify", {
      address: hollowAddress,
      constructorArguments: [
        HOLLOW_TOKEN_NAME,
        HOLLOW_TOKEN_SYMBOL,
        INITIAL_CLAIM_AMOUNT,
        INITIAL_CLAIM_FEE,
        INITIAL_CLAIM_COOLDOWN,
      ],
    });
    console.log(`${hollowAddress} verified successfully!`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("already verified")) {
      console.log(`${hollowAddress} is already verified.`);
    } else {
      console.error(`Verification failed for ${hollowAddress}:`, msg);
    }
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Deployment Complete!");
  console.log("═══════════════════════════════════════════════════");
  console.log(`HollowToken: ${hollowAddress}`);
  console.log(`\nUpdate your .env.local:`);
  console.log(`NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS=${hollowAddress}`);
  console.log(`\nGIWA Explorer:`);
  console.log(`https://sepolia-explorer.giwa.io/address/${hollowAddress}#code`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
