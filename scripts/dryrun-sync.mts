/**
 * Dry run of the reconciliation read path. Fetches live logs with the new paged
 * cursor walk and reports what WOULD be inserted/updated. Writes nothing.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const RAFFLES = process.env.NEXT_PUBLIC_RAFFLES_CONTRACT_ADDRESS!;
const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://sepolia-explorer.giwa.io";
const DEPLOY = BigInt(process.env.RAFFLES_DEPLOY_BLOCK ?? 0);
const T0 = "0x1b0046e2e77aea6587f950edd69a1600e2cd9d6e4fc798bd3921b27eadc648a9";
const PAGE_LIMIT = 1000;
const TOKEN_DECIMALS = 10n ** 18n;

type Log = { topics: string[]; data: string; transactionHash: string; blockNumber: bigint; logIndex: number };

async function page(id: number, from: bigint): Promise<Log[]> {
  const t1 = "0x" + BigInt(id).toString(16).padStart(64, "0");
  const url =
    `${EXPLORER}/api?module=logs&action=getLogs&fromBlock=${from}&toBlock=latest` +
    `&address=${RAFFLES}&topic0=${T0}&topic1=${t1}&topic0_1_opr=and`;
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  const b = await r.json();
  if (b.status !== "1") {
    if (/no logs found/i.test(b.message ?? "")) return [];
    throw new Error(b.message);
  }
  return (b.result ?? []).map((l: any) => ({
    topics: l.topics,
    data: l.data,
    transactionHash: l.transactionHash,
    blockNumber: BigInt(l.blockNumber),
    logIndex: Number(BigInt(l.logIndex ?? "0x0")),
  }));
}

async function walk(id: number, from: bigint, maxPages: number) {
  const out: Log[] = [];
  let cursor = from;
  let pages = 0;
  for (let p = 0; p < maxPages; p++) {
    const chunk = await page(id, cursor);
    pages++;
    out.push(...chunk);
    if (chunk.length < PAGE_LIMIT) break;
    const highest = chunk.reduce((m, l) => (l.blockNumber > m ? l.blockNumber : m), cursor);
    cursor = highest > cursor ? highest : cursor + 1n;
  }
  // dedupe
  const seen = new Set<string>();
  const uniq = out.filter((l) => {
    const k = `${l.transactionHash}:${l.logIndex}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { logs: uniq, pages, raw: out.length };
}

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data: raffles } = await supa
  .from("litvm_raffle_raffles")
  .select("id, title, slug, chain_raffle_id, tokens_required, max_entries_per_user, max_participants");

console.log(`deploy floor: ${DEPLOY}\n`);

for (const r of raffles ?? []) {
  if (r.chain_raffle_id == null) continue;
  const t0 = Date.now();
  const { logs, pages, raw } = await walk(r.chain_raffle_id, DEPLOY, 60);

  // fold by wallet, summing wei
  const folded = new Map<string, bigint>();
  for (const l of logs) {
    if (!l.topics[2]) continue;
    const w = ("0x" + l.topics[2].slice(-40)).toLowerCase();
    const wei = l.data && l.data !== "0x" ? BigInt(l.data) : 0n;
    if (wei <= 0n) continue;
    folded.set(w, (folded.get(w) ?? 0n) + wei);
  }

  // Paged, matching lib/supabase/paginate.ts — a plain select() stops at 1000.
  const existing: Array<{ wallet_address: string; entry_count: number }> = [];
  for (let p = 0; p < 200; p++) {
    const { data, error } = await supa
      .from("litvm_raffle_entries")
      .select("wallet_address, entry_count")
      .eq("raffle_id", r.id)
      .range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    existing.push(...rows);
    if (rows.length < 1000) break;
  }
  const db = new Map(existing.map((e) => [e.wallet_address.toLowerCase(), e.entry_count]));

  const ceiling = Math.min(r.max_entries_per_user > 0 ? r.max_entries_per_user : 2147483647,
                           Math.floor(2147483647 / r.tokens_required));
  let inserts = 0, updates = 0, zero = 0;
  for (const [w, wei] of folded) {
    const tickets = wei / TOKEN_DECIMALS / BigInt(r.tokens_required);
    const count = tickets <= 0n ? 0 : Math.min(Number(tickets), ceiling);
    if (count <= 0) { zero++; continue; }
    const cur = db.get(w);
    if (cur === undefined) inserts++;
    else if (count > cur) updates++;
  }

  console.log(`[${r.title}] slug=${r.slug} chain=${r.chain_raffle_id}`);
  console.log(`  pages=${pages} rawLogs=${raw} deduped=${logs.length} (${((Date.now()-t0)/1000).toFixed(1)}s)`);
  console.log(`  wallets on-chain=${folded.size}  DB rows=${db.size}  cap=${r.max_participants}`);
  console.log(`  WOULD insert=${inserts}  update=${updates}  skipped(sub-ticket)=${zero}`);
  console.log(`  => DB rows after sync: ${db.size + inserts}\n`);
}
