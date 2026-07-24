import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const address = process.env.NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS;
  if (!address || !ethers.isAddress(address)) {
    throw new Error("Set NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS in .env.local");
  }

  const HollowToken = await ethers.getContractAt("HollowToken", address);

  console.log("Token:", address);
  console.log("Claim Amount:", ethers.formatEther(await HollowToken.claimAmount()), "HOLLOW");
  console.log("Claim Fee:", ethers.formatEther(await HollowToken.claimFee()), "ETH");
  console.log("Cooldown:", (await HollowToken.claimCooldown()).toString(), "seconds");
  console.log("Owner:", await HollowToken.owner());
}

main().catch(console.error);
