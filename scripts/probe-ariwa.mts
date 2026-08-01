/**
 * Read-only diagnosis for a single raffle slug. Sends NO transactions.
 * Usage: node --experimental-strip-types scripts/probe-ariwa.mts [slug]
 */
import { createPublicClient, http, getAddress } from "viem";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const SLUG = process.argv[2] ?? "ariwa";
const RPC = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL!;
const RAFFLES = process.env.NEXT_PUBLIC_RAFFLES_CONTRACT_ADDRESS as `0x${string}`;
const chain = {
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 91342),
  name: "GIWA Sepolia",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: { default: { http: [RPC] } },
} as const;
const client = createPublicClient({ chain, transport: http(RPC) });

const abi = [
  {
    type: "function", name: "raffles", inputs: [{ type: "uint256" }],
    outputs: [
      { name: "id", type: "uint256" }, { name: "prizeToken", type: "address" },
      { name: "state", type: "uint8" }, { name: "prizeCount", type: "uint256" },
      { name: "isNFT", type: "bool" }, { name: "hasWinners", type: "bool" },
      { name: "creator", type: "address" }, { name: "endTime", type: "uint256" },
    ],
    stateMutability: "view",
  },
  { type: "function", name: "getRaffleState", inputs: [{ type: "uint256" }], outputs: [{ type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "getWinners", inputs: [{ type: "uint256" }], outputs: [{ type: "address[]" }], stateMutability: "view" },
  { type: "function", name: "owner", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "watchdog", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "paused", inputs: [], outputs: [{ type: "bool" }], stateMutability: "view" },
  {
    type: "function", name: "endRaffle",
    inputs: [
      { name: "raffleId_", type: "uint256" }, { name: "participants_", type: "address[]" },
      { name: "ticketCounts_", type: "uint256[]" }, { name: "randomSeed_", type: "uint256" },
    ],
    outputs: [], stateMutability: "nonpayable",
  },
] as const;

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

console.log(`now=${new Date().toISOString()} contract=${RAFFLES} rpc=${RPC}`);

const { data: r, error } = await supa
  .from("litvm_raffle_raffles").select("*").eq("slug", SLUG).single();
if (error || !r) { console.log("DB lookup failed:", error?.message); process.exit(1); }

console.log("\n--- DB row ---");
for (const k of ["id","title","slug","chain_raffle_id","status","start_date","end_date","max_participants","tokens_required","max_entries_per_user","entries_synced_at","entries_synced_block","created_at"]) {
  console.log(`  ${k}: ${JSON.stringify((r as Record<string, unknown>)[k])}`);
}
console.log(`  past end_date: ${new Date() >= new Date(r.end_date)}`);

const { count: entryCount } = await supa.from("litvm_raffle_entries")
  .select("id", { count: "exact", head: true }).eq("raffle_id", r.id);
const { count: prizeCount } = await supa.from("litvm_raffle_prizes")
  .select("id", { count: "exact", head: true }).eq("raffle_id", r.id);
const { data: dbWinners } = await supa.from("litvm_raffle_winners").select("*").eq("raffle_id", r.id);
console.log(`  DB entries=${entryCount} prizes=${prizeCount} winners=${dbWinners?.length ?? 0}`);
if (dbWinners?.length) console.log("  winner rows:", JSON.stringify(dbWinners, null, 1));

if (r.chain_raffle_id == null) { console.log("\nno chain_raffle_id — never deployed on-chain"); process.exit(0); }

console.log("\n--- chain ---");
const owner = await client.readContract({ address: RAFFLES, abi, functionName: "owner" });
const watchdog = await client.readContract({ address: RAFFLES, abi, functionName: "watchdog" });
const paused = await client.readContract({ address: RAFFLES, abi, functionName: "paused" });
console.log(`  owner=${owner}`);
console.log(`  watchdog=${watchdog}  (env WATCHDOG_ADDRESS=${process.env.WATCHDOG_ADDRESS})`);
console.log(`  paused=${paused}`);

const struct = await client.readContract({ address: RAFFLES, abi, functionName: "raffles", args: [BigInt(r.chain_raffle_id)] }) as readonly unknown[];
const STATE = ["CREATED","ACTIVE","COMPLETED","CANCELLED"];
console.log(`  raffles(${r.chain_raffle_id}) => id=${struct[0]} prizeToken=${struct[1]} state=${STATE[Number(struct[2])]}(${struct[2]}) prizeCount=${struct[3]} isNFT=${struct[4]} hasWinners=${struct[5]} creator=${struct[6]} endTime=${struct[7]}${Number(struct[7]) ? ` (${new Date(Number(struct[7]) * 1000).toISOString()})` : " (0 = no on-chain deadline)"}`);

const onchainWinners = await client.readContract({ address: RAFFLES, abi, functionName: "getWinners", args: [BigInt(r.chain_raffle_id)] }) as string[];
console.log(`  getWinners => ${onchainWinners.length}: ${JSON.stringify(onchainWinners)}`);

if (Number(struct[2]) !== 1) { console.log("\nnot ACTIVE on-chain; endRaffle simulate skipped"); process.exit(0); }

const { data: entries } = await supa.from("litvm_raffle_entries")
  .select("wallet_address, entry_count").eq("raffle_id", r.id)
  .order("created_at", { ascending: true }).range(0, 999);
const participants = (entries ?? []).map((e) => getAddress(e.wallet_address.toLowerCase() as `0x${string}`));
const tickets = (entries ?? []).map((e) => BigInt(e.entry_count));
console.log(`\n--- simulate endRaffle with ${participants.length} participants ---`);
for (const [label, from] of [["owner", owner], ["watchdog", watchdog]] as const) {
  try {
    await client.simulateContract({ address: RAFFLES, abi, functionName: "endRaffle", args: [BigInt(r.chain_raffle_id), participants, tickets, 123n], account: from as `0x${string}` });
    console.log(`  as ${label}: OK`);
  } catch (e) {
    const m = (e as Error).message;
    const reason = m.match(/reverted with the following reason:\s*\n(.+)/)?.[1] ?? m.split("\n")[0];
    console.log(`  as ${label}: REVERT -> ${reason.trim()}`);
  }
}
const bal = await client.getBalance({ address: watchdog as `0x${string}` });
console.log(`\n  watchdog ETH balance: ${bal} wei (${Number(bal) / 1e18} ETH)`);
