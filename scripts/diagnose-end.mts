/**
 * Read-only: counts on-chain EntrySubmitted logs per raffle and eth_call-simulates
 * endRaffle as owner and as watchdog to surface the exact revert reason.
 * Sends NO transactions.
 */
import { createPublicClient, http, getAddress, encodeEventTopics } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const RPC = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL!;
const RAFFLES = process.env.NEXT_PUBLIC_RAFFLES_CONTRACT_ADDRESS as `0x${string}`;
const chain = {
  id: 91342, name: "GIWA Sepolia",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: { default: { http: [RPC] } },
} as const;
const client = createPublicClient({ chain, transport: http(RPC) });

const abi = [
  {
    type: "function", name: "endRaffle",
    inputs: [
      { name: "raffleId_", type: "uint256" }, { name: "participants_", type: "address[]" },
      { name: "ticketCounts_", type: "uint256[]" }, { name: "randomSeed_", type: "uint256" },
    ],
    outputs: [], stateMutability: "nonpayable",
  },
  {
    type: "event", name: "EntrySubmitted",
    inputs: [
      { name: "raffleId", type: "uint256", indexed: true },
      { name: "participant", type: "address", indexed: true },
      { name: "tokensSpent", type: "uint256", indexed: false },
    ],
  },
  { type: "function", name: "owner", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "watchdog", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
] as const;

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const owner = (await client.readContract({ address: RAFFLES, abi, functionName: "owner" })) as `0x${string}`;
const watchdog = (await client.readContract({ address: RAFFLES, abi, functionName: "watchdog" })) as `0x${string}`;

const { data: raffles } = await supa
  .from("litvm_raffle_raffles")
  .select("id, title, slug, chain_raffle_id, max_participants, end_date");

const head = await client.getBlockNumber();
console.log(`head block: ${head}  now: ${new Date().toISOString()}`);
console.log(`owner=${owner} watchdog=${watchdog}`);

for (const r of raffles ?? []) {
  if (r.chain_raffle_id == null) continue;
  console.log("=".repeat(74));
  console.log(`[${r.title}] slug=${r.slug} chainId=${r.chain_raffle_id} max=${r.max_participants}`);

  // --- count on-chain EntrySubmitted logs for this raffle ---
  const [t0, t1] = encodeEventTopics({ abi, eventName: "EntrySubmitted", args: { raffleId: BigInt(r.chain_raffle_id) } }) as [string, string];
  const wallets = new Set<string>();
  let logCount = 0;
  let to = head;
  const STEP = 100_000n;
  while (to > 0n) {
    const from = to > STEP ? to - STEP + 1n : 0n;
    const chunk = (await client.request({
      method: "eth_getLogs",
      params: [{ address: RAFFLES, topics: [t0, t1], fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}` }],
    } as any)) as Array<{ topics: string[] }>;
    logCount += chunk.length;
    for (const l of chunk) if (l.topics[2]) wallets.add(`0x${l.topics[2].slice(-40)}`.toLowerCase());
    if (from === 0n) break;
    to = from - 1n;
  }
  console.log(`  on-chain EntrySubmitted logs: ${logCount}  unique wallets: ${wallets.size}`);

  const { data: entries } = await supa
    .from("litvm_raffle_entries").select("wallet_address, entry_count")
    .eq("raffle_id", r.id).order("created_at", { ascending: true });
  console.log(`  DB entry rows: ${entries?.length ?? 0}`);

  const participants = (entries ?? []).map((e) => getAddress(e.wallet_address.toLowerCase() as `0x${string}`));
  const ticketCounts = (entries ?? []).map((e) => BigInt(e.entry_count));
  if (participants.length === 0) { console.log("  no participants; skipping simulate"); continue; }

  for (const [label, from] of [["owner", owner], ["watchdog", watchdog]] as const) {
    try {
      const { request } = await client.simulateContract({
        address: RAFFLES, abi, functionName: "endRaffle",
        args: [BigInt(r.chain_raffle_id), participants, ticketCounts, 123n],
        account: from,
      });
      let gas = "n/a";
      try {
        gas = String(await client.estimateContractGas({
          address: RAFFLES, abi, functionName: "endRaffle",
          args: [BigInt(r.chain_raffle_id), participants, ticketCounts, 123n],
          account: from,
        }));
      } catch (e) { gas = `estimate failed: ${(e as Error).message.split("\n")[0]}`; }
      console.log(`  simulate endRaffle as ${label}: OK  gas=${gas}`);
    } catch (e) {
      const m = (e as Error).message;
      const reason = m.match(/reverted with the following reason:\s*\n(.+)/)?.[1] ?? m.split("\n")[0];
      console.log(`  simulate endRaffle as ${label}: REVERT -> ${reason.trim()}`);
    }
  }
}
