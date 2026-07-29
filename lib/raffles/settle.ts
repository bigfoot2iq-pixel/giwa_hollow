import { randomBytes } from "crypto";
import { createPublicClient, createWalletClient, getAddress, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { RobinhoodRafflesABI, contracts, giwaSepolia } from "@/lib/contracts";
import type { createServiceClient } from "@/lib/supabase/server";
import { syncRaffleEntriesFromChain } from "@/lib/raffles/sync-entries";
import { selectAllPaged } from "@/lib/supabase/paginate";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

// On-chain RobinhoodRaffles.RaffleState enum
const RAFFLE_STATE = { CREATED: 0, ACTIVE: 1, COMPLETED: 2, CANCELLED: 3 } as const;

// Max raffles touched per invocation. Keeps each cron run short (single-EOA
// watchdog sends tx sequentially) so frequent runs don't overrun their window.
// Oldest raffles are processed first, so a backlog drains in order across runs.
const BATCH_SIZE = Math.max(1, Number(process.env.SETTLE_BATCH_SIZE ?? 20));

export type SettleAction = {
  raffleId: string;
  chainRaffleId: number;
  title: string;
  txHash?: string;
  winners?: number;
  reason?: string;
};

export type SettleSummary = {
  activated: SettleAction[];
  ended: SettleAction[];
  skipped: SettleAction[];
  errors: SettleAction[];
};

function msg(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

function getRpcUrl(): string {
  return (
    process.env.RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    "https://sepolia-rpc.giwa.io"
  );
}

function getClients() {
  const privateKey = process.env.WATCHDOG_PRIVATE_KEY;
  const raffleContract = contracts.raffles.address;
  if (!privateKey) throw new Error("Missing WATCHDOG_PRIVATE_KEY");
  if (!raffleContract) throw new Error("Missing NEXT_PUBLIC_RAFFLES_CONTRACT_ADDRESS");

  const rpcUrl = getRpcUrl();
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const publicClient = createPublicClient({ chain: giwaSepolia, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ chain: giwaSepolia, transport: http(rpcUrl), account });
  return { publicClient, walletClient, raffleContract };
}

async function countRows(
  supabase: ServiceClient,
  table: "litvm_raffle_entries" | "litvm_raffle_prizes",
  raffleId: string
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("raffle_id", raffleId);
  if (error) {
    console.error(`Error counting ${table} for raffle ${raffleId}:`, error);
    return 0;
  }
  return count ?? 0;
}

async function persistWinners(
  supabase: ServiceClient,
  raffleId: string,
  winners: string[],
  txHash: string
): Promise<void> {
  if (winners.length === 0) return;

  const { data: prizes } = await supabase
    .from("litvm_raffle_prizes")
    .select("prize_amount, prize_token_id")
    .eq("raffle_id", raffleId)
    .order("created_at", { ascending: true });

  const rows = winners.map((wallet, index) => ({
    raffle_id: raffleId,
    wallet_address: wallet.toLowerCase(),
    prize_amount: prizes?.[index]?.prize_amount ?? null,
    prize_token_id: prizes?.[index]?.prize_token_id ?? null,
    distribution_tx_hash: txHash,
  }));

  const { error } = await supabase.from("litvm_raffle_winners").insert(rows);
  if (error) {
    console.error(`Error inserting winners for raffle ${raffleId}:`, error);
    return;
  }

  for (const wallet of winners) {
    const { error: incErr } = await supabase.rpc("litvm_raffle_increment_user_wins", {
      p_wallet: wallet.toLowerCase(),
    });
    if (incErr) console.error(`Error incrementing wins for ${wallet}:`, incErr);
  }
}

/**
 * HTTP-triggered port of the standalone watchdog loop. Activates raffles whose
 * window has opened (still CREATED on-chain) and settles raffles past their
 * end_date (or full) that are still ACTIVE on-chain.
 *
 * On-chain RaffleState is the source of truth / idempotency guard: a raffle that
 * has already been ended is COMPLETED and is silently skipped, so re-running this
 * never double-sends endRaffle. Settlement is processed sequentially because the
 * watchdog wallet is a single EOA — parallel writes would collide on the nonce.
 */
export async function processExpiredRaffles(supabase: ServiceClient): Promise<SettleSummary> {
  const summary: SettleSummary = { activated: [], ended: [], skipped: [], errors: [] };
  const { publicClient, walletClient, raffleContract } = getClients();
  const nowIso = new Date().toISOString();

  const readState = (chainId: number) =>
    publicClient
      .readContract({
        address: raffleContract,
        abi: RobinhoodRafflesABI,
        functionName: "getRaffleState",
        args: [BigInt(chainId)],
      })
      .then((s) => Number(s));

  // ---- Activate raffles whose window has opened but are still CREATED on-chain ----
  const { data: toStart, error: startErr } = await supabase
    .from("litvm_raffle_raffles")
    .select("id, chain_raffle_id, title")
    .lte("start_date", nowIso)
    .gt("end_date", nowIso)
    .not("chain_raffle_id", "is", null)
    .order("chain_raffle_id", { ascending: true })
    .limit(BATCH_SIZE);

  if (startErr) throw new Error(`Failed to load raffles to start: ${startErr.message}`);

  for (const raffle of toStart ?? []) {
    const chainId = raffle.chain_raffle_id;
    if (!chainId) continue;
    try {
      if ((await readState(chainId)) !== RAFFLE_STATE.CREATED) continue;

      const txHash = await walletClient.writeContract({
        address: raffleContract,
        abi: RobinhoodRafflesABI,
        functionName: "activateRaffle",
        args: [BigInt(chainId)],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") {
        summary.errors.push({ raffleId: raffle.id, chainRaffleId: chainId, title: raffle.title, txHash, reason: "activate tx reverted" });
        continue;
      }
      summary.activated.push({ raffleId: raffle.id, chainRaffleId: chainId, title: raffle.title, txHash });
    } catch (err) {
      summary.errors.push({ raffleId: raffle.id, chainRaffleId: chainId, title: raffle.title, reason: `activate: ${msg(err)}` });
    }
  }

  // ---- End raffles past end_date (or full) that are still ACTIVE on-chain ----
  const { data: started, error: endErr } = await supabase
    .from("litvm_raffle_raffles")
    .select(
      "id, chain_raffle_id, title, end_date, max_participants, tokens_required, max_entries_per_user"
    )
    .lte("start_date", nowIso)
    .not("chain_raffle_id", "is", null)
    .order("end_date", { ascending: true })
    .limit(BATCH_SIZE);

  if (endErr) throw new Error(`Failed to load raffles to end: ${endErr.message}`);

  for (const raffle of started ?? []) {
    const chainId = raffle.chain_raffle_id;
    if (!chainId) continue;
    try {
      if ((await readState(chainId)) !== RAFFLE_STATE.ACTIVE) continue;

      // The draw is built from the DB, so reconcile against EntrySubmitted logs
      // first — otherwise anyone who joined by calling the contract directly is
      // excluded from endRaffle. Forced: a throttled read here loses entrants.
      await syncRaffleEntriesFromChain(supabase, raffle, { force: true });

      const participantCount = await countRows(supabase, "litvm_raffle_entries", raffle.id);
      const isPastEnd = new Date() >= new Date(raffle.end_date);
      const isFull = participantCount >= raffle.max_participants;
      if (!isPastEnd && !isFull) continue; // not time to end yet

      const prizeCount = await countRows(supabase, "litvm_raffle_prizes", raffle.id);
      if (prizeCount === 0) {
        summary.skipped.push({ raffleId: raffle.id, chainRaffleId: chainId, title: raffle.title, reason: "no prizes configured" });
        continue;
      }

      // Paged: a plain select() stops at PostgREST's 1000-row cap, which would
      // hand endRaffle a fraction of the entrants and draw winners from it.
      const entries = await selectAllPaged<{ wallet_address: string; entry_count: number }>(
        (from, to) =>
          supabase
            .from("litvm_raffle_entries")
            .select("wallet_address, entry_count")
            .eq("raffle_id", raffle.id)
            .order("created_at", { ascending: true })
            .range(from, to)
      );

      if (entries.length !== participantCount) {
        // The draw must cover every counted entrant or the result is not fair.
        summary.errors.push({
          raffleId: raffle.id,
          chainRaffleId: chainId,
          title: raffle.title,
          reason: `entry read incomplete: got ${entries.length} of ${participantCount}`,
        });
        continue;
      }

      const participants = entries.map((e) =>
        getAddress(e.wallet_address.toLowerCase() as `0x${string}`)
      );
      const ticketCounts = entries.map((e) => BigInt(e.entry_count));

      if (participants.length > 0 && participants.length < prizeCount) {
        summary.skipped.push({ raffleId: raffle.id, chainRaffleId: chainId, title: raffle.title, reason: `participants(${participants.length}) < prizes(${prizeCount})` });
        continue;
      }

      const randomSeed = BigInt(`0x${randomBytes(32).toString("hex")}`);
      const txHash = await walletClient.writeContract({
        address: raffleContract,
        abi: RobinhoodRafflesABI,
        functionName: "endRaffle",
        args: [BigInt(chainId), participants, ticketCounts, randomSeed],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") {
        summary.errors.push({ raffleId: raffle.id, chainRaffleId: chainId, title: raffle.title, txHash, reason: "end tx reverted" });
        continue;
      }

      const winners = (await publicClient.readContract({
        address: raffleContract,
        abi: RobinhoodRafflesABI,
        functionName: "getWinners",
        args: [BigInt(chainId)],
      })) as string[];

      await persistWinners(supabase, raffle.id, winners, txHash);

      summary.ended.push({ raffleId: raffle.id, chainRaffleId: chainId, title: raffle.title, txHash, winners: winners.length });
    } catch (err) {
      summary.errors.push({ raffleId: raffle.id, chainRaffleId: chainId, title: raffle.title, reason: `end: ${msg(err)}` });
    }
  }

  return summary;
}
