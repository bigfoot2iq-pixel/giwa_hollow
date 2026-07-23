import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const HollowToken = await ethers.getContractAt(
    "HollowToken",
    "0xf3dC2ea554d015bcd8e815A7C2eF29340636D4f8"
  );

  for (let i = 0; i < 4; i++) {
    const name = await HollowToken.getCategoryName(i);
    const amount = await HollowToken.getCategoryAmount(i);
    const fee = await HollowToken.getCategoryFee(i);
    console.log(`Category ${i}: name="${name}", amount=${ethers.formatEther(amount)}, fee=${ethers.formatEther(fee)} ETH`);
  }

  console.log("\nCooldown:", (await HollowToken.claimCooldown()).toString(), "seconds");
  console.log("Owner:", await HollowToken.owner());
}

main().catch(console.error);
