import pkg from "hardhat";
const { run } = pkg;

const ARIWA_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS ?? "";

const ARIWA_TOKEN_ARGS = [
  "ARIWA",
  "ARIWA",
  "86400",
];

async function main() {
  if (!ARIWA_TOKEN_ADDRESS) {
    throw new Error("Set NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS in .env.local");
  }
  console.log("═══════════════════════════════════════════════════");
  console.log("  AriwaToken Verification (GIWA Explorer)");
  console.log("═══════════════════════════════════════════════════\n");
  console.log(`Verifying AriwaToken at ${ARIWA_TOKEN_ADDRESS}...`);

  try {
    await run("verify:verify", {
      address: ARIWA_TOKEN_ADDRESS,
      constructorArguments: ARIWA_TOKEN_ARGS,
    });
    console.log("AriwaToken verified on GIWA Explorer!");
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("already verified")) {
      console.log("AriwaToken is already verified on GIWA Explorer.");
    } else {
      console.error("Verification failed:", msg);
    }
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Done! Check:");
  console.log(`  https://sepolia-explorer.giwa.io/address/${ARIWA_TOKEN_ADDRESS}#code`);
  console.log("═══════════════════════════════════════════════════");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
