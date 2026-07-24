import { readFileSync, writeFileSync } from "node:fs";

function abiOf(artifactPath) {
  return JSON.parse(readFileSync(artifactPath, "utf8")).abi;
}

const token = abiOf("artifacts/contracts/HollowToken.sol/HollowToken.json");
const raffles = abiOf("artifacts/contracts/HollowRaffles.sol/HollowRaffles.json");
const game = abiOf("artifacts/contracts/TheHollowGame.sol/TheHollowGame.json");

writeFileSync(
  "lib/contracts/HollowTokenABI.ts",
  `export const HollowTokenABI = ${JSON.stringify(token, null, 2)} as const;\n`,
);

writeFileSync(
  "lib/contracts/RobinhoodRafflesABI.ts",
  `export const RobinhoodRafflesABI = ${JSON.stringify(raffles, null, 2)} as const;\n`,
);

writeFileSync(
  "lib/contracts/theHollowGame.ts",
  `// TheHollowGame Contract ABI and Config\n` +
    `// Deploy the contract from contracts/TheHollowGame.sol and update the address below\n\n` +
    "export const THE_HOLLOW_GAME_ADDRESS = process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS as `0x${string}` || '0x0000000000000000000000000000000000000000';\n\n" +
    `export const THE_HOLLOW_GAME_ABI = ${JSON.stringify(game, null, 2)} as const;\n`,
);

console.log("ABIs written:");
console.log("  HollowTokenABI.ts       fns:", token.length);
console.log("  RobinhoodRafflesABI.ts  fns:", raffles.length);
console.log("  theHollowGame.ts        fns:", game.length);
