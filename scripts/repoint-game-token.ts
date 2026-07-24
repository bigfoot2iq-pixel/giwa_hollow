import pkg from "hardhat";
const { ethers } = pkg;

// Points the deployed TheHollowGame at the current HollowToken (both from .env.local).
const GAME = process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS;
const TOKEN = process.env.NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS;

async function main() {
  if (!GAME || !ethers.isAddress(GAME)) throw new Error("Set NEXT_PUBLIC_GAME_CONTRACT_ADDRESS");
  if (!TOKEN || !ethers.isAddress(TOKEN)) throw new Error("Set NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS");

  const game = await ethers.getContractAt("TheHollowGame", GAME);
  const current = await game.hollowToken();
  console.log("Game:", GAME);
  console.log("Current paymentToken:", current);
  console.log("Target token:", TOKEN);

  if (current.toLowerCase() === TOKEN.toLowerCase()) {
    console.log("Already pointed at target token. Nothing to do.");
    return;
  }

  console.log("Calling setPaymentToken...");
  const tx = await game.setPaymentToken(TOKEN);
  await tx.wait();
  console.log("Done. New paymentToken:", await game.hollowToken());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
