import pkg from "hardhat";
const { ethers, run } = pkg;

const HOLLOW_TOKEN_NAME = "GIWA Hollow";
const HOLLOW_TOKEN_SYMBOL = "GIWA";
const INITIAL_CLAIM_COOLDOWN = 43_200; // 12 hours

const CATEGORIES = [
  { name: "Bronze", amount: ethers.parseEther("50"), fee: ethers.parseEther("0.0001") },
  { name: "Silver", amount: ethers.parseEther("100"), fee: ethers.parseEther("0.0005") },
  { name: "Gold", amount: ethers.parseEther("200"), fee: ethers.parseEther("0.001") },
  { name: "Platinum", amount: ethers.parseEther("500"), fee: ethers.parseEther("0.005") },
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("═══════════════════════════════════════════════════");
  console.log("  HollowToken Deployment (GIWA Sepolia)");
  console.log("═══════════════════════════════════════════════════");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("Claim Cooldown:", INITIAL_CLAIM_COOLDOWN, "seconds");
  CATEGORIES.forEach((c, i) => {
    console.log(`Category ${i + 1} (${c.name}): ${ethers.formatEther(c.amount)} GIWA, fee ${ethers.formatEther(c.fee)} ETH`);
  });
  console.log("");

  console.log("Deploying HollowToken...");
  const HollowToken = await ethers.getContractFactory("HollowToken");
  const hollowToken = await HollowToken.deploy(
    HOLLOW_TOKEN_NAME,
    HOLLOW_TOKEN_SYMBOL,
    INITIAL_CLAIM_COOLDOWN,
  );
  await hollowToken.waitForDeployment();
  const hollowAddress = await hollowToken.getAddress();
  console.log(`HollowToken deployed to: ${hollowAddress}`);

  console.log("\nSetting categories...");
  for (let i = 0; i < CATEGORIES.length; i++) {
    const c = CATEGORIES[i];
    console.log(`  Setting category ${i}: ${c.name}...`);
    await (await hollowToken.setCategory(i, c.name, c.amount, c.fee)).wait();
  }
  console.log("Categories set.");

  console.log("\nWaiting 30s for explorer to index the contract...");
  await new Promise((resolve) => setTimeout(resolve, 30_000));

  console.log(`\nVerifying ${hollowAddress} on GIWA Explorer...`);
  try {
    await run("verify:verify", {
      address: hollowAddress,
      constructorArguments: [
        HOLLOW_TOKEN_NAME,
        HOLLOW_TOKEN_SYMBOL,
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
