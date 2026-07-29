import { createPublicClient, encodeEventTopics, http } from "viem";
import { RobinhoodRafflesABI, contracts, giwaSepolia } from "@/lib/contracts";
import type { createServiceClient } from "@/lib/supabase/server";
import { selectAllPaged } from "@/lib/supabase/paginate";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/**
 * Reconciles `litvm_raffle_entries` with the chain.
 *
 * `POST /api/entries` is the only writer of entries, so anyone who calls
 * `joinRaffle` directly on the contract is invisible to the platform: no row,
 * no participant count, and — worst of all — excluded from the `endRaffle`
 * participant array the watchdog builds from the DB.
 *
 * `EntrySubmitted(raffleId, participant, tokensSpent)` logs are the only
 * chain-side source (the contract keeps no participant registry), so we replay
 * them, fold them per wallet, and write back only the differences. When there
 * is no drift nothing is written and callers keep serving the DB.
 */

const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_EXPLORER_URL ||
  giwaSepolia.blockExplorers?.default?.url ||
  "https://sepolia-explorer.giwa.io";

// Per-raffle throttle, persisted in litvm_raffle_raffles.entries_synced_at.
// It has to be persisted rather than in-memory: on serverless each instance gets
// its own module state, so a cold start or a second concurrent instance would
// re-fetch immediately and the rate limit would be per-instance, not per-raffle.
// Settled raffles can only change if someone joins a closed raffle, so back off hard.
const SYNC_TTL_MS = 300_000;
const ENDED_SYNC_TTL_MS = 3_600_000;

// Hard bound on the explorer call. Without this a hanging explorer keeps the
// function alive until it hits the platform duration cap — the most expensive
// possible outcome on a per-duration billing model, and a 504 on a public page.
const EXPLORER_TIMEOUT_MS = 4_000;

// GIWA's Blockscout truncates `getLogs` at 1000 rows and ignores page/offset
// (verified against the live explorer), so a full response means "there is more"
// and the only cursor available is fromBlock. Reading a raffle with 10k entrants
// as a single call silently returned the oldest 1000 and dropped the rest.
const EXPLORER_PAGE_LIMIT = 1000;

// Page budget for throttled (user-facing) syncs. The cursor is persisted after
// every run, so a raffle with a large backlog still drains across calls instead
// of blocking one request until the duration cap. Forced syncs are unbounded.
const MAX_PAGES_THROTTLED = 2;
const MAX_PAGES_FORCED = 60;

// The RPC fallback walks in chunks, so give it room while still bounding it.
const RPC_TIMEOUT_MS = 8_000;

// The GIWA RPC rejects eth_getLogs spans wider than this ("query exceeds max
// block range 100000"), so the RPC fallback has to walk in chunks.
const RPC_MAX_BLOCK_RANGE = 100_000n;

// How far back the RPC fallback walks when no deploy block is configured.
// Only used when the explorer is unreachable.
const FALLBACK_LOOKBACK_BLOCKS = BigInt(
  process.env.RAFFLES_LOG_LOOKBACK_BLOCKS ?? 2_000_000
);

const DEPLOY_BLOCK = process.env.RAFFLES_DEPLOY_BLOCK
  ? BigInt(process.env.RAFFLES_DEPLOY_BLOCK)
  : undefined;

// Rows per insert statement. Supabase sends an array insert as one statement, so
// a single unique violation rolls back every row in it — one racing entry used to
// discard the entire reconciliation. Chunking bounds that, and the retry path
// below narrows a failed chunk down to just the offending rows.
const INSERT_CHUNK_SIZE = 500;

const TOKEN_DECIMALS = 10n ** 18n;

// tokens_spent / entry_count are Postgres INTEGER columns.
const PG_INT_MAX = 2_147_483_647;

export interface SyncableRaffle {
  id: string;
  chain_raffle_id: number | null;
  tokens_required: number;
  max_entries_per_user: number;
  end_date: string;
  /** Persisted throttle marker. Absent on callers that didn't select it. */
  entries_synced_at?: string | null;
  /** Highest block already reconciled. Absent on callers that didn't select it. */
  entries_synced_block?: number | string | null;
}

/** Columns `syncRaffleEntriesFromChain` needs. Use in route `.select()` calls. */
export const SYNCABLE_RAFFLE_COLUMNS =
  "id, chain_raffle_id, tokens_required, max_entries_per_user, end_date, entries_synced_at, entries_synced_block";

/** Normalised log shape shared by the explorer and RPC paths. */
interface RawEntryLog {
  // Blockscout pads `topics` to 4 entries with nulls.
  topics: readonly (string | null)[];
  data: string;
  transactionHash: string;
  blockNumber: bigint;
  logIndex: number;
}

interface FoldedEntry {
  tokensWei: bigint;
  txHash: string;
  blockNumber: bigint;
  logIndex: number;
}

const lastSyncedAt = new Map<string, number>();
const inFlight = new Map<string, Promise<void>>();

function toBigInt(value: string | number | bigint): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value.startsWith("0x") ? value : value.trim() === "" ? "0" : value);
}

function entryTopics(chainRaffleId: number): [string, string] {
  const topics = encodeEventTopics({
    abi: RobinhoodRafflesABI,
    eventName: "EntrySubmitted",
    args: { raffleId: BigInt(chainRaffleId) },
  });
  return [topics[0] as string, topics[1] as string];
}

/** One page of Blockscout's legacy `logs` module. Keyless. */
async function fetchExplorerPage(
  chainRaffleId: number,
  fromBlock: bigint
): Promise<RawEntryLog[]> {
  const [topic0, topic1] = entryTopics(chainRaffleId);
  const url =
    `${EXPLORER_BASE}/api?module=logs&action=getLogs` +
    `&fromBlock=${fromBlock}&toBlock=latest` +
    `&address=${contracts.raffles.address}` +
    `&topic0=${topic0}&topic1=${topic1}&topic0_1_opr=and`;

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(EXPLORER_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Explorer getLogs failed: HTTP ${response.status}`);
  }

  const body = (await response.json()) as {
    status?: string;
    message?: string;
    result?: Array<{
      topics: string[];
      data: string;
      transactionHash: string;
      blockNumber: string;
      logIndex: string;
    }>;
  };

  // status "0" with "No logs found" is a valid empty result, not a failure.
  if (body.status !== "1") {
    if (/no logs found/i.test(body.message ?? "")) return [];
    throw new Error(`Explorer getLogs error: ${body.message ?? "unknown"}`);
  }

  return (body.result ?? []).map((log) => ({
    topics: log.topics,
    data: log.data,
    transactionHash: log.transactionHash,
    blockNumber: toBigInt(log.blockNumber),
    logIndex: Number(toBigInt(log.logIndex ?? "0x0")),
  }));
}

/**
 * Walk the explorer from `fromBlock` to head, following a block cursor.
 *
 * A full page means the response was truncated, so the next page restarts at the
 * highest block seen — not that block plus one, because a block's logs can
 * straddle the cap. That re-reads the boundary block, hence the caller dedupes.
 */
async function fetchLogsFromExplorer(
  chainRaffleId: number,
  fromBlock: bigint,
  maxPages: number
): Promise<RawEntryLog[]> {
  const logs: RawEntryLog[] = [];
  let cursor = fromBlock;

  for (let page = 0; page < maxPages; page++) {
    const chunk = await fetchExplorerPage(chainRaffleId, cursor);
    logs.push(...chunk);

    if (chunk.length < EXPLORER_PAGE_LIMIT) break;

    const highest = chunk.reduce((max, log) => (log.blockNumber > max ? log.blockNumber : max), cursor);
    // A single block holding more than a full page would pin the cursor forever.
    // Stepping past it loses those logs, but stalling loses every later block too.
    cursor = highest > cursor ? highest : cursor + 1n;
  }

  return logs;
}

/**
 * Fallback for when the explorer is down. Walks forward from `fromBlock` in
 * RPC_MAX_BLOCK_RANGE chunks (the GIWA RPC rejects wider spans).
 *
 * Forward from a persisted cursor rather than backwards from head: the old
 * direction re-read the same FALLBACK_LOOKBACK_BLOCKS window on every call —
 * 20 sequential eth_getLogs against a 15s budget, which is what timed the
 * public raffle routes out. Coverage can still be partial when no cursor and no
 * deploy block are known, which is why the diff step never lowers a count.
 */
async function fetchLogsFromRpc(
  chainRaffleId: number,
  fromBlock: bigint,
  maxChunks: number
): Promise<RawEntryLog[]> {
  const rpcUrl =
    process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rpc.giwa.io";
  const client = createPublicClient({
    chain: giwaSepolia,
    transport: http(rpcUrl, { timeout: RPC_TIMEOUT_MS }),
  });

  const head = await client.getBlockNumber();
  const [topic0, topic1] = entryTopics(chainRaffleId);

  // With neither a persisted cursor nor a configured deploy block there is no
  // floor, and walking forward from genesis would scan the entire chain. Cap the
  // lookback instead; coverage is then partial, which is safe because the diff
  // step only ever raises a count.
  let cursor = fromBlock;
  if (cursor === 0n && DEPLOY_BLOCK === undefined) {
    cursor = head > FALLBACK_LOOKBACK_BLOCKS ? head - FALLBACK_LOOKBACK_BLOCKS : 0n;
  }

  const logs: RawEntryLog[] = [];
  for (let chunkIndex = 0; chunkIndex < maxChunks && cursor <= head; chunkIndex++) {
    const toBlock = cursor + RPC_MAX_BLOCK_RANGE - 1n > head ? head : cursor + RPC_MAX_BLOCK_RANGE - 1n;

    const chunk = await client.request({
      method: "eth_getLogs",
      params: [
        {
          address: contracts.raffles.address,
          topics: [topic0, topic1],
          fromBlock: `0x${cursor.toString(16)}`,
          toBlock: `0x${toBlock.toString(16)}`,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any) as Array<{
      topics: string[];
      data: string;
      transactionHash: string;
      blockNumber: string;
      logIndex: string;
    }>;

    for (const log of chunk) {
      logs.push({
        topics: log.topics,
        data: log.data,
        transactionHash: log.transactionHash,
        blockNumber: toBigInt(log.blockNumber),
        logIndex: Number(toBigInt(log.logIndex ?? "0x0")),
      });
    }

    cursor = toBlock + 1n;
  }

  return logs;
}

/** Lowest block worth scanning when a raffle has never been synced. */
function defaultFloor(): bigint {
  return DEPLOY_BLOCK ?? 0n;
}

/** Drop the boundary-block duplicates produced by the paged walk. */
function dedupeLogs(logs: RawEntryLog[]): RawEntryLog[] {
  const seen = new Set<string>();
  const unique: RawEntryLog[] = [];
  for (const log of logs) {
    const key = `${log.transactionHash}:${log.logIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(log);
  }
  return unique;
}

/** Fold logs into one record per wallet, keeping the most recent tx hash. */
function foldByWallet(logs: RawEntryLog[]): Map<string, FoldedEntry> {
  const folded = new Map<string, FoldedEntry>();

  for (const log of logs) {
    // topics: [signature, raffleId, participant]; participant is a padded address.
    const participantTopic = log.topics[2];
    if (!participantTopic) continue;
    const wallet = `0x${participantTopic.slice(-40)}`.toLowerCase();
    const tokensWei = log.data && log.data !== "0x" ? toBigInt(log.data) : 0n;
    if (tokensWei <= 0n) continue;

    const existing = folded.get(wallet);
    if (!existing) {
      folded.set(wallet, {
        tokensWei,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
      });
      continue;
    }

    existing.tokensWei += tokensWei;
    const isNewer =
      log.blockNumber > existing.blockNumber ||
      (log.blockNumber === existing.blockNumber && log.logIndex > existing.logIndex);
    if (isNewer) {
      existing.txHash = log.transactionHash;
      existing.blockNumber = log.blockNumber;
      existing.logIndex = log.logIndex;
    }
  }

  return folded;
}

/**
 * wei -> whole tokens -> tickets. `joinRaffle` emits the raw wei transferred
 * and the UI charges `entryCount * tokens_required` whole tokens per entry
 * (see RaffleEntryForm), so this inverts that exactly.
 *
 * Direct callers are still held to `max_entries_per_user`: the contract does
 * not enforce it, and letting a bypass buy unlimited tickets would be worse
 * than the invisibility bug we are fixing.
 */
function toEntryCount(tokensWei: bigint, raffle: SyncableRaffle): number {
  if (raffle.tokens_required <= 0) return 0;
  const tokens = tokensWei / TOKEN_DECIMALS;
  const tickets = tokens / BigInt(raffle.tokens_required);
  if (tickets <= 0n) return 0;

  const ceiling = Math.min(
    raffle.max_entries_per_user > 0 ? raffle.max_entries_per_user : PG_INT_MAX,
    Math.floor(PG_INT_MAX / raffle.tokens_required)
  );
  return Math.min(Number(tickets), ceiling);
}

async function reconcile(
  supabase: ServiceClient,
  raffle: SyncableRaffle,
  maxPages: number
): Promise<bigint | null> {
  const chainRaffleId = raffle.chain_raffle_id;
  if (chainRaffleId === null) return null;

  // Resume where the last run stopped. The cursor block itself is re-read rather
  // than skipped, because a block's logs can straddle the explorer page limit.
  const fromBlock =
    raffle.entries_synced_block !== undefined && raffle.entries_synced_block !== null
      ? BigInt(raffle.entries_synced_block)
      : defaultFloor();

  let logs: RawEntryLog[];
  try {
    logs = await fetchLogsFromExplorer(chainRaffleId, fromBlock, maxPages);
  } catch (explorerErr) {
    console.warn(
      `Entry sync: explorer log fetch failed for raffle ${raffle.id}, falling back to RPC:`,
      explorerErr instanceof Error ? explorerErr.message : explorerErr
    );
    logs = await fetchLogsFromRpc(chainRaffleId, fromBlock, maxPages);
  }

  logs = dedupeLogs(logs);
  if (logs.length === 0) return null;

  const highestBlock = logs.reduce(
    (max, log) => (log.blockNumber > max ? log.blockNumber : max),
    fromBlock
  );

  const folded = foldByWallet(logs);
  if (folded.size === 0) return highestBlock;

  // Paged: PostgREST truncates at 1000 rows, and a short read here reads as
  // "these wallets are new", so the reconciler retries inserts that already
  // exist and the unique violation takes the whole batch down with it.
  const existingRows = await selectAllPaged<{ wallet_address: string; entry_count: number }>(
    (from, to) =>
      supabase
        .from("litvm_raffle_entries")
        .select("wallet_address, entry_count")
        .eq("raffle_id", raffle.id)
        .range(from, to)
  );

  const dbCounts = new Map<string, number>(
    existingRows.map((row) => [row.wallet_address.toLowerCase(), row.entry_count])
  );

  type Insert = { wallet: string; entryCount: number; txHash: string };
  type Update = { wallet: string; entryCount: number; delta: number };
  const inserts: Insert[] = [];
  const updates: Update[] = [];

  for (const [wallet, entry] of folded) {
    const entryCount = toEntryCount(entry.tokensWei, raffle);
    if (entryCount <= 0) continue; // entry_count/tokens_spent are CHECK (> 0)

    const dbCount = dbCounts.get(wallet);
    if (dbCount === undefined) {
      inserts.push({ wallet, entryCount, txHash: entry.txHash });
    } else if (entryCount > dbCount) {
      // Only ever increase. Chain is a superset of the DB, so a lower on-chain
      // number means incomplete log coverage, not a refund.
      updates.push({ wallet, entryCount, delta: entryCount - dbCount });
    }
  }

  if (inserts.length === 0 && updates.length === 0) return highestBlock; // no drift

  if (inserts.length > 0) {
    const toRow = (row: Insert) => ({
      raffle_id: raffle.id,
      wallet_address: row.wallet,
      tokens_spent: row.entryCount * raffle.tokens_required,
      entry_count: row.entryCount,
      tx_hash: row.txHash,
    });

    // Only wallets that actually landed get their user stats incremented, so a
    // skipped duplicate never double-counts.
    const inserted: Insert[] = [];

    for (let start = 0; start < inserts.length; start += INSERT_CHUNK_SIZE) {
      const chunk = inserts.slice(start, start + INSERT_CHUNK_SIZE);
      const { error: insertErr } = await supabase
        .from("litvm_raffle_entries")
        .insert(chunk.map(toRow));

      if (!insertErr) {
        inserted.push(...chunk);
        continue;
      }

      // A concurrent POST /api/entries can win the race on either unique index
      // (tx_hash, or raffle_id+wallet_address), and the whole statement rolls
      // back with it. Re-run the chunk row by row so one collision costs one row
      // instead of the entire batch.
      console.warn(
        `Entry sync: chunk insert failed for raffle ${raffle.id} (${insertErr.message}), retrying ${chunk.length} rows individually`
      );
      for (const row of chunk) {
        const { error: rowErr } = await supabase
          .from("litvm_raffle_entries")
          .insert(toRow(row));
        if (!rowErr) inserted.push(row);
        else if (rowErr.code !== "23505") {
          // 23505 is the expected unique violation for an entry that raced us.
          console.error(
            `Entry sync: insert failed for raffle ${raffle.id} wallet ${row.wallet}:`,
            rowErr.message
          );
        }
      }
    }

    if (inserted.length > 0) {
      // One statement for the batch. This used to be an awaited RPC per wallet,
      // which at 10k entrants exhausted the invocation before finishing and left
      // user stats permanently short.
      const { error: statsErr } = await supabase.rpc("litvm_raffle_increment_user_entries_bulk", {
        p_wallets: inserted.map((row) => row.wallet),
        p_counts: inserted.map((row) => row.entryCount),
      });
      if (statsErr) {
        console.error(`Entry sync: bulk user-stat increment failed for raffle ${raffle.id}:`, statsErr.message);
      }
    }
  }

  // Each row carries a different count, so the writes stay per-row, but the
  // stat increments are folded into one call afterwards.
  const updated: Update[] = [];
  for (const row of updates) {
    // tx_hash is left alone: it is UNIQUE and the original row already carries
    // valid proof of entry.
    const { error: updateErr } = await supabase
      .from("litvm_raffle_entries")
      .update({
        entry_count: row.entryCount,
        tokens_spent: row.entryCount * raffle.tokens_required,
      })
      .eq("raffle_id", raffle.id)
      .eq("wallet_address", row.wallet);

    if (updateErr) {
      console.error(
        `Entry sync: update failed for raffle ${raffle.id} wallet ${row.wallet}:`,
        updateErr.message
      );
      continue;
    }
    updated.push(row);
  }

  if (updated.length > 0) {
    const { error: statsErr } = await supabase.rpc("litvm_raffle_increment_user_entries_bulk", {
      p_wallets: updated.map((row) => row.wallet),
      p_counts: updated.map((row) => row.delta),
    });
    if (statsErr) {
      console.error(`Entry sync: bulk user-stat increment failed for raffle ${raffle.id}:`, statsErr.message);
    }
  }

  console.log(
    `Entry sync: raffle ${raffle.id} (chain ${chainRaffleId}) reconciled ` +
      `${inserts.length} new + ${updates.length} updated from ${logs.length} logs ` +
      `(blocks ${fromBlock}..${highestBlock})`
  );

  return highestBlock;
}

function ttlFor(raffle: SyncableRaffle): number {
  return new Date(raffle.end_date) <= new Date() ? ENDED_SYNC_TTL_MS : SYNC_TTL_MS;
}

/**
 * True when the persisted marker says the window has not elapsed. Falls back to
 * a targeted read when the caller didn't select `entries_synced_at`.
 */
async function isThrottled(supabase: ServiceClient, raffle: SyncableRaffle): Promise<boolean> {
  let syncedAt = raffle.entries_synced_at;

  if (syncedAt === undefined) {
    const { data } = await supabase
      .from("litvm_raffle_raffles")
      .select("entries_synced_at")
      .eq("id", raffle.id)
      .single();
    syncedAt = data?.entries_synced_at ?? null;
  }

  if (!syncedAt) return false; // never synced
  return Date.now() - new Date(syncedAt).getTime() < ttlFor(raffle);
}

/**
 * Reconcile one raffle's entries against the chain. Never throws: on any failure
 * the caller simply serves whatever the DB already has.
 *
 * Throttled by the persisted `entries_synced_at` marker so the rate limit holds
 * across serverless instances, cold starts, and redeploys. The in-memory map is
 * only a free fast path in front of it, and the in-flight map collapses
 * concurrent callers within one instance.
 *
 * `force` skips the throttle — used before settlement, where a stale read would
 * silently drop direct entrants from the on-chain draw.
 */
export async function syncRaffleEntriesFromChain(
  supabase: ServiceClient,
  raffle: SyncableRaffle,
  options: { force?: boolean } = {}
): Promise<void> {
  if (raffle.chain_raffle_id === null) return;

  const pending = inFlight.get(raffle.id);
  if (pending) return pending;

  if (!options.force) {
    // Fast path: this instance synced recently, so skip without any I/O.
    const last = lastSyncedAt.get(raffle.id);
    if (last !== undefined && Date.now() - last < ttlFor(raffle)) return;
    if (await isThrottled(supabase, raffle)) {
      lastSyncedAt.set(raffle.id, Date.now());
      return;
    }
  }

  const run = (async () => {
    let syncedBlock: bigint | null = null;
    try {
      syncedBlock = await reconcile(
        supabase,
        raffle,
        options.force ? MAX_PAGES_FORCED : MAX_PAGES_THROTTLED
      );
    } catch (err) {
      console.error(
        `Entry sync failed for raffle ${raffle.id}:`,
        err instanceof Error ? err.message : err
      );
    } finally {
      // Stamped even on failure: a persistently unreachable explorer must not
      // make every request retry. Recovery is delayed by one window at worst.
      lastSyncedAt.set(raffle.id, Date.now());
      inFlight.delete(raffle.id);

      // The cursor only advances on success, so a failed run re-reads the same
      // range rather than skipping past logs it never saw. A throttled run that
      // exhausted its page budget still records progress, letting a large
      // backlog drain across calls instead of restarting from the floor.
      const stamp: { entries_synced_at: string; entries_synced_block?: string } = {
        entries_synced_at: new Date().toISOString(),
      };
      if (syncedBlock !== null) stamp.entries_synced_block = syncedBlock.toString();

      const { error: stampErr } = await supabase
        .from("litvm_raffle_raffles")
        .update(stamp)
        .eq("id", raffle.id);
      if (stampErr) {
        console.error(`Entry sync: failed to stamp sync time for ${raffle.id}:`, stampErr.message);
      }
    }
  })();

  inFlight.set(raffle.id, run);
  return run;
}

/** Reconcile a set of raffles with bounded concurrency. */
export async function syncManyRaffleEntriesFromChain(
  supabase: ServiceClient,
  raffles: SyncableRaffle[],
  concurrency = 5
): Promise<void> {
  const queue = raffles.filter((r) => r.chain_raffle_id !== null);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (cursor < queue.length) {
      const raffle = queue[cursor++];
      await syncRaffleEntriesFromChain(supabase, raffle);
    }
  });

  await Promise.all(workers);
}

/**
 * Bulk reconcile every open raffle. This is the primary sync path — running it
 * from the cron keeps the work off user-facing requests, which only need the
 * throttled check as a safety net.
 *
 * Deliberately throttle-respecting rather than forced, so cron frequency does
 * not drive cost: the persisted window governs regardless of how often this runs.
 */
export async function reconcileOpenRaffles(supabase: ServiceClient): Promise<number> {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("litvm_raffle_raffles")
    .select(SYNCABLE_RAFFLE_COLUMNS)
    .lte("start_date", nowIso)
    .gt("end_date", nowIso)
    .not("chain_raffle_id", "is", null);

  if (error) {
    console.error("Entry sync: failed to load open raffles:", error.message);
    return 0;
  }

  const raffles = (data ?? []) as SyncableRaffle[];
  await syncManyRaffleEntriesFromChain(supabase, raffles);
  return raffles.length;
}
