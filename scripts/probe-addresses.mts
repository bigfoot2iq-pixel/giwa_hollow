/** Read-only: identify what is deployed at a set of addresses. */
import { createPublicClient, http } from "viem";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const RPC = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL!;
const chain = {
  id: 91342, name: "GIWA Sepolia",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: { default: { http: [RPC] } },
} as const;
const client = createPublicClient({ chain, transport: http(RPC) });

const targets: Record<string, `0x${string}`> = {
  "NEW game (user)": "0xdc93043C9c385fb2C16DB393E95aD520c02B445a",
  "NEW raffles (user)": "0x63a3dF4F2ceB32BB10E779F702bA33FaEEDE78f6",
  "NEW token (user)": "0xfa34680F6D98f4EE858A07D27080141a3aa52cc0",
  "env raffles": process.env.NEXT_PUBLIC_RAFFLES_CONTRACT_ADDRESS as `0x${string}`,
  "env token": process.env.NEXT_PUBLIC_HOLLOW_TOKEN_ADDRESS as `0x${string}`,
  "env game": process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS as `0x${string}`,
};

const probes: { sig: string; abi: any }[] = [
  { sig: "name()", abi: { type: "function", name: "name", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" } },
  { sig: "symbol()", abi: { type: "function", name: "symbol", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" } },
  { sig: "owner()", abi: { type: "function", name: "owner", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" } },
  { sig: "watchdog()", abi: { type: "function", name: "watchdog", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" } },
  { sig: "raffleCounter()", abi: { type: "function", name: "raffleCounter", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" } },
  { sig: "raffleToken()", abi: { type: "function", name: "raffleToken", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" } },
  { sig: "getPlayPrice()", abi: { type: "function", name: "getPlayPrice", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" } },
  { sig: "gameToken()", abi: { type: "function", name: "gameToken", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" } },
  { sig: "claimAmount()", abi: { type: "function", name: "claimAmount", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" } },
  { sig: "totalSupply()", abi: { type: "function", name: "totalSupply", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" } },
];

for (const [label, addr] of Object.entries(targets)) {
  console.log("=".repeat(70));
  if (!addr) { console.log(`${label}: <unset>`); continue; }
  const code = await client.getCode({ address: addr });
  console.log(`${label}\n  ${addr}\n  bytecode: ${code && code !== "0x" ? `${(code.length - 2) / 2} bytes` : "NONE (not a contract)"}`);
  if (!code || code === "0x") continue;
  for (const p of probes) {
    try {
      const v = await client.readContract({ address: addr, abi: [p.abi], functionName: p.abi.name });
      console.log(`  ${p.sig.padEnd(18)} = ${v}`);
    } catch { /* function absent */ }
  }
}
