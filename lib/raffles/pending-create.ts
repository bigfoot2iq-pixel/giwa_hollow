/**
 * Durable record of a raffle that exists on-chain but not yet in the database.
 *
 * Creating a raffle is a two-phase commit: the wallet sends a transaction that
 * escrows the prize, then the browser POSTs the metadata so the row can be
 * written. If the second phase does not land, the prize sits locked in the
 * contract and the raffle is invisible to every listing — five raffles were lost
 * that way (chain ids 3-7).
 *
 * The pending state used to live in React state alone, so a refresh, a crashed
 * tab, or navigating away destroyed the only record that the transaction had
 * been sent. Persisting it means the confirm step can be retried later, by a
 * different page load, with a fresh signature.
 *
 * Scoped per wallet so a shared browser cannot leak one admin's draft into
 * another's session.
 */

const STORAGE_PREFIX = "giwa:pending-raffle-create";

export interface PendingRaffleCreate {
  txHash: string;
  /** Metadata to replay into the confirm endpoint. Shape is route-specific. */
  raffleData: unknown;
  /** "admin" -> /api/admin/raffles/confirm, "community" -> /api/raffles/create */
  kind: "admin" | "community";
  /** Wallet that sent the transaction; the community endpoint verifies it. */
  wallet: string;
  savedAt: number;
}

function keyFor(wallet: string): string {
  return `${STORAGE_PREFIX}:${wallet.toLowerCase()}`;
}

function available(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function savePendingCreate(entry: Omit<PendingRaffleCreate, "savedAt">): void {
  if (!available()) return;
  try {
    window.localStorage.setItem(
      keyFor(entry.wallet),
      JSON.stringify({ ...entry, savedAt: Date.now() } satisfies PendingRaffleCreate)
    );
  } catch {
    // A full or disabled store must not break the create flow; the in-memory
    // retry path still covers the common case.
  }
}

export function loadPendingCreate(wallet: string | undefined): PendingRaffleCreate | null {
  if (!available() || !wallet) return null;
  try {
    const raw = window.localStorage.getItem(keyFor(wallet));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingRaffleCreate;
    if (!parsed?.txHash || !parsed?.raffleData) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingCreate(wallet: string | undefined): void {
  if (!available() || !wallet) return;
  try {
    window.localStorage.removeItem(keyFor(wallet));
  } catch {
    /* nothing useful to do */
  }
}
