import pkg from "hardhat";
const { run } = pkg;

const HOLLOW_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS ?? "";

const HOLLOW_TOKEN_ARGS = [
  "Hollow Token",
  "HOLLOW",
  "86400",
];

async function main() {
  if (!HOLLOW_TOKEN_ADDRESS) {
    throw new Error("Set NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS in .env.local");
  }
  console.log("═══════════════════════════════════════════════════");
  console.log("  HollowToken Verification (GIWA Explorer)");
  console.log("═══════════════════════════════════════════════════\n");
  console.log(`Verifying HollowToken at ${HOLLOW_TOKEN_ADDRESS}...`);

  try {
    await run("verify:verify", {
      address: HOLLOW_TOKEN_ADDRESS,
      constructorArguments: HOLLOW_TOKEN_ARGS,
    });
    console.log("HollowToken verified on GIWA Explorer!");
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("already verified")) {
      console.log("HollowToken is already verified on GIWA Explorer.");
    } else {
      console.error("Verification failed:", msg);
    }
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Done! Check:");
  console.log(`  https://sepolia-explorer.giwa.io/address/${HOLLOW_TOKEN_ADDRESS}#code`);
  console.log("═══════════════════════════════════════════════════");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
