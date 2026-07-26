import { createPublicClient, encodeEventTopics, http } from "viem";
import { RobinhoodRafflesABI, contracts, giwaSepolia } from "@/lib/contracts";
import type { createServiceClient } from "@/lib/supabase/server";

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

// The RPC fallback walks in chunks, so give it room while still bounding it.
const RPC_TIMEOUT_MS = 8_000;

// The GIWA RPC rejects eth_getLogs spans wider than this ("query exceeds max
// block range 100000"), so the RPC fallback has to walk in chunks.
const RPC_MAX_BLOCK_RANGE = 100_000n;

// How far back the RPC fallback walks when no deploy block is configured.
// Only used when the explorer (which has no range cap) is unreachable.
const FALLBACK_LOOKBACK_BLOCKS = BigInt(
  process.env.RAFFLES_LOG_LOOKBACK_BLOCKS ?? 2_000_000
);

const DEPLOY_BLOCK = process.env.RAFFLES_DEPLOY_BLOCK
  ? BigInt(process.env.RAFFLES_DEPLOY_BLOCK)
  : undefined;

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
}

/** Columns `syncRaffleEntriesFromChain` needs. Use in route `.select()` calls. */
export const SYNCABLE_RAFFLE_COLUMNS =
  "id, chain_raffle_id, tokens_required, max_entries_per_user, end_date, entries_synced_at";

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

/**
 * Blockscout's legacy `logs` module has no block-range cap, so a single call
 * covers the contract's whole history. Keyless.
 */
async function fetchLogsFromExplorer(chainRaffleId: number): Promise<RawEntryLog[]> {
  const [topic0, topic1] = entryTopics(chainRaffleId);
  const url =
    `${EXPLORER_BASE}/api?module=logs&action=getLogs` +
    `&fromBlock=${DEPLOY_BLOCK ?? 0n}&toBlock=latest` +
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
 * Fallback for when the explorer is down. Walks backwards from head in
 * RPC_MAX_BLOCK_RANGE chunks, bounded by DEPLOY_BLOCK when configured and by
 * FALLBACK_LOOKBACK_BLOCKS otherwise — so coverage here can be partial, which
 * is why the diff step never lowers an existing count.
 */
async function fetchLogsFromRpc(chainRaffleId: number): Promise<RawEntryLog[]> {
  const rpcUrl =
    process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rpc.giwa.io";
  const client = createPublicClient({
    chain: giwaSepolia,
    transport: http(rpcUrl, { timeout: RPC_TIMEOUT_MS }),
  });

  const head = await client.getBlockNumber();
  const floor = DEPLOY_BLOCK ?? (head > FALLBACK_LOOKBACK_BLOCKS ? head - FALLBACK_LOOKBACK_BLOCKS : 0n);
  const [topic0, topic1] = entryTopics(chainRaffleId);

  const logs: RawEntryLog[] = [];
  let toBlock = head;
  while (toBlock >= floor) {
    const span = toBlock - floor + 1n;
    const fromBlock = span > RPC_MAX_BLOCK_RANGE ? toBlock - RPC_MAX_BLOCK_RANGE + 1n : floor;

    const chunk = await client.request({
      method: "eth_getLogs",
      params: [
        {
          address: contracts.raffles.address,
          topics: [topic0, topic1],
          fromBlock: `0x${fromBlock.toString(16)}`,
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

    if (fromBlock === 0n || fromBlock <= floor) break;
    toBlock = fromBlock - 1n;
  }

  return logs;
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

async function reconcile(supabase: ServiceClient, raffle: SyncableRaffle): Promise<void> {
  const chainRaffleId = raffle.chain_raffle_id;
  if (chainRaffleId === null) return;

  let logs: RawEntryLog[];
  try {
    logs = await fetchLogsFromExplorer(chainRaffleId);
  } catch (explorerErr) {
    console.warn(
      `Entry sync: explorer log fetch failed for raffle ${raffle.id}, falling back to RPC:`,
      explorerErr instanceof Error ? explorerErr.message : explorerErr
    );
    logs = await fetchLogsFromRpc(chainRaffleId);
  }

  if (logs.length === 0) return;

  const folded = foldByWallet(logs);
  if (folded.size === 0) return;

  const { data: existingRows, error: readErr } = await supabase
    .from("litvm_raffle_entries")
    .select("wallet_address, entry_count")
    .eq("raffle_id", raffle.id);

  if (readErr) throw new Error(`Failed to read existing entries: ${readErr.message}`);

  const dbCounts = new Map<string, number>(
    (existingRows ?? []).map((row) => [row.wallet_address.toLowerCase(), row.entry_count])
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

  if (inserts.length === 0 && updates.length === 0) return; // no drift

  if (inserts.length > 0) {
    const { error: insertErr } = await supabase.from("litvm_raffle_entries").insert(
      inserts.map((row) => ({
        raffle_id: raffle.id,
        wallet_address: row.wallet,
        tokens_spent: row.entryCount * raffle.tokens_required,
        entry_count: row.entryCount,
        tx_hash: row.txHash,
      }))
    );
    if (insertErr) {
      // A concurrent POST /api/entries can win the race on either unique index
      // (tx_hash, or raffle_id+wallet_address); the next sync settles it.
      console.error(`Entry sync: insert failed for raffle ${raffle.id}:`, insertErr.message);
    } else {
      for (const row of inserts) {
        await supabase.rpc("litvm_raffle_increment_user_entries", {
          p_wallet: row.wallet,
          p_count: row.entryCount,
        });
      }
    }
  }

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
    await supabase.rpc("litvm_raffle_increment_user_entries", {
      p_wallet: row.wallet,
      p_count: row.delta,
    });
  }

  console.log(
    `Entry sync: raffle ${raffle.id} (chain ${chainRaffleId}) reconciled ` +
      `${inserts.length} new + ${updates.length} updated from ${logs.length} logs`
  );
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
    try {
      await reconcile(supabase, raffle);
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
      const { error: stampErr } = await supabase
        .from("litvm_raffle_raffles")
        .update({ entries_synced_at: new Date().toISOString() })
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
