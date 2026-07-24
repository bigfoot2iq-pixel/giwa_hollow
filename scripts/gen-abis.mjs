import { readFileSync, writeFileSync } from "node:fs";

function abiOf(artifactPath) {
  return JSON.parse(readFileSync(artifactPath, "utf8")).abi;
}

const token = abiOf("artifacts/contracts/AriwaToken.sol/AriwaToken.json");
const raffles = abiOf("artifacts/contracts/AriwaRaffles.sol/AriwaRaffles.json");
const game = abiOf("artifacts/contracts/TheAriwaGame.sol/TheAriwaGame.json");

writeFileSync(
  "lib/contracts/AriwaTokenABI.ts",
  `export const AriwaTokenABI = ${JSON.stringify(token, null, 2)} as const;\n`,
);

writeFileSync(
  "lib/contracts/RobinhoodRafflesABI.ts",
  `export const RobinhoodRafflesABI = ${JSON.stringify(raffles, null, 2)} as const;\n`,
);

writeFileSync(
  "lib/contracts/theAriwaGame.ts",
  `// TheAriwaGame Contract ABI and Config\n` +
    `// Deploy the contract from contracts/TheAriwaGame.sol and update the address below\n\n` +
    "export const THE_ARIWA_GAME_ADDRESS = process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS as `0x${string}` || '0x0000000000000000000000000000000000000000';\n\n" +
    `export const THE_ARIWA_GAME_ABI = ${JSON.stringify(game, null, 2)} as const;\n`,
);

console.log("ABIs written:");
console.log("  AriwaTokenABI.ts       fns:", token.length);
console.log("  RobinhoodRafflesABI.ts  fns:", raffles.length);
console.log("  theAriwaGame.ts        fns:", game.length);
