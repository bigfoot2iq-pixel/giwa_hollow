import pkg from "hardhat";
const { ethers } = pkg;

// Points the deployed AriwaRaffles at the current AriwaToken (both from .env.local).
const RAFFLES = process.env.NEXT_PUBLIC_RAFFLES_CONTRACT_ADDRESS;
const TOKEN = process.env.NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS;

async function main() {
  if (!RAFFLES || !ethers.isAddress(RAFFLES)) throw new Error("Set NEXT_PUBLIC_RAFFLES_CONTRACT_ADDRESS");
  if (!TOKEN || !ethers.isAddress(TOKEN)) throw new Error("Set NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS");

  const raffles = await ethers.getContractAt("AriwaRaffles", RAFFLES);
  const current = await raffles.raffleToken();
  console.log("Raffles:", RAFFLES);
  console.log("Current raffleToken:", current);
  console.log("Target token:", TOKEN);

  if (current.toLowerCase() === TOKEN.toLowerCase()) {
    console.log("Already pointed at target token. Nothing to do.");
    return;
  }

  console.log("Calling setRaffleToken...");
  const tx = await raffles.setRaffleToken(TOKEN);
  await tx.wait();
  console.log("Done. New raffleToken:", await raffles.raffleToken());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
