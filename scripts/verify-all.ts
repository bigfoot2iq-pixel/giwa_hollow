import pkg from "hardhat";
const { ethers, run } = pkg;

const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS ?? "";
const RAFFLES_ADDRESS = process.env.NEXT_PUBLIC_RAFFLES_CONTRACT_ADDRESS ?? "";
const GAME_ADDRESS = process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS ?? "";
const WATCHDOG_ADDRESS = process.env.WATCHDOG_ADDRESS ?? "";

async function verify(name: string, address: string, constructorArguments: unknown[]) {
  console.log(`\nVerifying ${name} at ${address}...`);
  try {
    await run("verify:verify", { address, constructorArguments });
    console.log(`✅ ${name} verified!`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("already verified")) {
      console.log(`✅ ${name} already verified.`);
    } else {
      console.error(`❌ ${name} verification failed:`, msg);
    }
  }
}

async function main() {
  const missing = [
    !TOKEN_ADDRESS && "NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS",
    !RAFFLES_ADDRESS && "NEXT_PUBLIC_RAFFLES_CONTRACT_ADDRESS",
    !GAME_ADDRESS && "NEXT_PUBLIC_GAME_CONTRACT_ADDRESS",
    !WATCHDOG_ADDRESS && "WATCHDOG_ADDRESS",
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }

  console.log("═══════════════════════════════════════════════════");
  console.log("  Contract Verification — GIWA Sepolia Explorer");
  console.log("═══════════════════════════════════════════════════");
  console.log(`AriwaToken:    ${TOKEN_ADDRESS}`);
  console.log(`AriwaRaffles:  ${RAFFLES_ADDRESS}`);
  console.log(`TheAriwaGame:  ${GAME_ADDRESS}`);
  console.log(`Watchdog:      ${WATCHDOG_ADDRESS}`);

  await verify("AriwaToken", TOKEN_ADDRESS, [
    "ARIWA",
    "ARIWA",
    ethers.parseEther("1"),
    0n,
    43200,
  ]);

  await verify("AriwaRaffles", RAFFLES_ADDRESS, [
    TOKEN_ADDRESS,
    WATCHDOG_ADDRESS,
  ]);

  await verify("TheAriwaGame", GAME_ADDRESS, [TOKEN_ADDRESS]);

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Done! Explorer links:");
  console.log(`  https://sepolia-explorer.giwa.io/address/${TOKEN_ADDRESS}#code`);
  console.log(`  https://sepolia-explorer.giwa.io/address/${RAFFLES_ADDRESS}#code`);
  console.log(`  https://sepolia-explorer.giwa.io/address/${GAME_ADDRESS}#code`);
  console.log("═══════════════════════════════════════════════════");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
