import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  const address = process.env.NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS;
  if (!address || !ethers.isAddress(address)) {
    throw new Error("Set NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS in .env.local");
  }

  const AriwaToken = await ethers.getContractAt("AriwaToken", address);

  console.log("Token:", address);
  console.log("Claim Amount:", ethers.formatEther(await AriwaToken.claimAmount()), "ARIWA");
  console.log("Claim Fee:", ethers.formatEther(await AriwaToken.claimFee()), "ETH");
  console.log("Cooldown:", (await AriwaToken.claimCooldown()).toString(), "seconds");
  console.log("Owner:", await AriwaToken.owner());
}

main().catch(console.error);
