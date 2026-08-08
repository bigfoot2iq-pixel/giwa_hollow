/**
 * One-off: reseed the ARIWA raffle with 10 REAL on-chain entries and set its
 * displayed joiner count.
 *
 * The raffle's ~10k entry rows were pruned to fit the Supabase hobby tier, which
 * collapsed the card "Joined" count and the detail "Participants" stat to 0. This
 * inserts 10 genuine EntrySubmitted entrants (real wallets + real tx hashes, so
 * the explorer links work) for the detail list, and stamps participants_display
 * = 10000 so both surfaces report the true joiner total again.
 *
 * Idempotent: entry inserts ignore duplicates, and the display stamp is a fixed
 * write. Reads .env.local. Run: node --experimental-strip-types scripts/seed-ariwa-sample-entries.mts
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
// keccak256("EntrySubmitted(uint256,address,uint256)")
const T0 = "0x1b0046e2e77aea6587f950edd69a1600e2cd9d6e4fc798bd3921b27eadc648a9";
const PAGE_LIMIT = 1000;
const MAX_PAGES = 5;
const TOKEN_DECIMALS = 10n ** 18n;
const SAMPLE_SIZE = 10;
const PARTICIPANTS_DISPLAY = 10000;
const RAFFLE_SLUG = "ariwa";

type Log = { topics: string[]; data: string; transactionHash: string; blockNumber: bigint; logIndex: number };

async function page(chainId: number, from: bigint): Promise<Log[]> {
  const t1 = "0x" + BigInt(chainId).toString(16).padStart(64, "0");
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

/** Walk from the deploy floor, deduping the boundary-block re-reads. */
async function collectLogs(chainId: number): Promise<Log[]> {
  const out: Log[] = [];
  let cursor = DEPLOY;
  for (let p = 0; p < MAX_PAGES; p++) {
    const chunk = await page(chainId, cursor);
    out.push(...chunk);
    if (chunk.length < PAGE_LIMIT) break;
    const highest = chunk.reduce((m, l) => (l.blockNumber > m ? l.blockNumber : m), cursor);
    cursor = highest > cursor ? highest : cursor + 1n;
  }
  const seen = new Set<string>();
  return out.filter((l) => {
    const k = `${l.transactionHash}:${l.logIndex}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const { data: raffle, error: raffleErr } = await supa
  .from("litvm_raffle_raffles")
  .select("id, chain_raffle_id, tokens_required, max_entries_per_user")
  .eq("slug", RAFFLE_SLUG)
  .single();
if (raffleErr || !raffle) throw new Error(`raffle '${RAFFLE_SLUG}' not found: ${raffleErr?.message}`);
if (raffle.chain_raffle_id == null) throw new Error("raffle has no chain_raffle_id");

console.log(`raffle ${raffle.id} chain=${raffle.chain_raffle_id} tokens_required=${raffle.tokens_required} max/user=${raffle.max_entries_per_user}`);

const logs = await collectLogs(raffle.chain_raffle_id);
console.log(`fetched ${logs.length} EntrySubmitted logs from block ${DEPLOY}`);

// Fold per wallet: sum wei, keep first-seen order and the latest tx hash.
type Folded = { wei: bigint; txHash: string; firstBlock: bigint; firstIdx: number; lastBlock: bigint; lastIdx: number };
const folded = new Map<string, Folded>();
for (const l of logs) {
  if (!l.topics[2]) continue;
  const wallet = ("0x" + l.topics[2].slice(-40)).toLowerCase();
  const wei = l.data && l.data !== "0x" ? BigInt(l.data) : 0n;
  if (wei <= 0n) continue;
  const cur = folded.get(wallet);
  if (!cur) {
    folded.set(wallet, { wei, txHash: l.transactionHash, firstBlock: l.blockNumber, firstIdx: l.logIndex, lastBlock: l.blockNumber, lastIdx: l.logIndex });
    continue;
  }
  cur.wei += wei;
  if (l.blockNumber > cur.lastBlock || (l.blockNumber === cur.lastBlock && l.logIndex > cur.lastIdx)) {
    cur.txHash = l.transactionHash;
    cur.lastBlock = l.blockNumber;
    cur.lastIdx = l.logIndex;
  }
}

const ceiling = Math.min(
  raffle.max_entries_per_user > 0 ? raffle.max_entries_per_user : 2147483647,
  Math.floor(2147483647 / raffle.tokens_required)
);
const toEntryCount = (wei: bigint) => {
  const tickets = wei / TOKEN_DECIMALS / BigInt(raffle.tokens_required);
  return tickets <= 0n ? 0 : Math.min(Number(tickets), ceiling);
};

// Earliest entrants first, then take the first 10 with a valid (>0) ticket count.
const ordered = [...folded.entries()].sort((a, b) =>
  a[1].firstBlock === b[1].firstBlock ? a[1].firstIdx - b[1].firstIdx : Number(a[1].firstBlock - b[1].firstBlock)
);
const rows = [];
for (const [wallet, f] of ordered) {
  const entryCount = toEntryCount(f.wei);
  if (entryCount <= 0) continue;
  rows.push({
    raffle_id: raffle.id,
    wallet_address: wallet,
    tokens_spent: entryCount * raffle.tokens_required,
    entry_count: entryCount,
    tx_hash: f.txHash,
  });
  if (rows.length >= SAMPLE_SIZE) break;
}

if (rows.length === 0) throw new Error("no valid on-chain entries found to seed");
if (rows.length < SAMPLE_SIZE) console.warn(`only found ${rows.length} valid entrants (wanted ${SAMPLE_SIZE})`);

const { error: insErr, count } = await supa
  .from("litvm_raffle_entries")
  .upsert(rows, { onConflict: "raffle_id,wallet_address", ignoreDuplicates: true, count: "exact" });
if (insErr) throw new Error(`entry insert failed: ${insErr.message}`);
console.log(`inserted ${count ?? 0} sample entr${(count ?? 0) === 1 ? "y" : "ies"} (of ${rows.length} candidates; duplicates skipped)`);
for (const r of rows) console.log(`  ${r.wallet_address}  x${r.entry_count}  ${r.tx_hash}`);

const { error: dispErr } = await supa
  .from("litvm_raffle_raffles")
  .update({ participants_display: PARTICIPANTS_DISPLAY })
  .eq("id", raffle.id);
if (dispErr) throw new Error(`display stamp failed: ${dispErr.message}`);
console.log(`set participants_display = ${PARTICIPANTS_DISPLAY}`);
console.log("done.");
