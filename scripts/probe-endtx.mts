/** Read-only: locate the RaffleEnded tx for a chain raffle id + dump admin logs. */
import { createPublicClient, http, encodeEventTopics, decodeEventLog } from "viem";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const CHAIN_ID = BigInt(process.argv[2] ?? 1);
const RPC = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL!;
const RAFFLES = process.env.NEXT_PUBLIC_RAFFLES_CONTRACT_ADDRESS as `0x${string}`;
const chain = {
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 91342), name: "GIWA Sepolia",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: { default: { http: [RPC] } },
} as const;
const client = createPublicClient({ chain, transport: http(RPC) });

const abi = [
  {
    type: "event", name: "RaffleEnded",
    inputs: [
      { name: "raffleId", type: "uint256", indexed: true },
      { name: "winners", type: "address[]", indexed: false },
      { name: "totalParticipants", type: "uint256", indexed: false },
      { name: "totalTickets", type: "uint256", indexed: false },
    ],
  },
] as const;

const [t0, t1] = encodeEventTopics({ abi, eventName: "RaffleEnded", args: { raffleId: CHAIN_ID } }) as [string, string];
const head = await client.getBlockNumber();
const STEP = 100_000n;
let to = head;
const found: Array<{ topics: string[]; data: string; transactionHash: string; blockNumber: string }> = [];
while (to > 0n) {
  const from = to > STEP ? to - STEP + 1n : 0n;
  const chunk = (await client.request({
    method: "eth_getLogs",
    params: [{ address: RAFFLES, topics: [t0, t1], fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}` }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)) as typeof found;
  found.push(...chunk);
  if (from === 0n) break;
  to = from - 1n;
}
console.log(`RaffleEnded logs for chain raffle ${CHAIN_ID}: ${found.length}`);
for (const log of found) {
  const decoded = decodeEventLog({ abi, eventName: "RaffleEnded", topics: log.topics as [`0x${string}`, ...`0x${string}`[]], data: log.data as `0x${string}` });
  const block = await client.getBlock({ blockNumber: BigInt(log.blockNumber) });
  const receipt = await client.getTransactionReceipt({ hash: log.transactionHash as `0x${string}` });
  console.log(`  tx=${log.transactionHash}`);
  console.log(`  block=${BigInt(log.blockNumber)} time=${new Date(Number(block.timestamp) * 1000).toISOString()}`);
  console.log(`  from=${receipt.from} gasUsed=${receipt.gasUsed}`);
  console.log(`  args=${JSON.stringify(decoded.args, (_, v) => typeof v === "bigint" ? v.toString() : v)}`);
}

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data: logs, error } = await supa.from("litvm_raffle_admin_logs")
  .select("*").order("created_at", { ascending: false }).limit(25);
console.log(`\nadmin logs (${error?.message ?? logs?.length}):`);
for (const l of logs ?? []) console.log(" ", l.created_at, l.action, JSON.stringify(l.details));

const { data: winners } = await supa.from("litvm_raffle_winners").select("*").limit(20);
console.log(`\nALL rows in litvm_raffle_winners: ${winners?.length ?? 0}`);
for (const w of winners ?? []) console.log(" ", JSON.stringify(w));
