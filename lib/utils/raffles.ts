import type { RaffleStatus } from "@/lib/supabase";

/**
 * Determine raffle status. If chainStatus is provided (from on-chain state),
 * it takes priority. Otherwise falls back to date-based calculation.
 */
export function getRaffleStatus(startDate: string, endDate: string, now = new Date(), chainStatus?: RaffleStatus): RaffleStatus {
  if (chainStatus) {
    return chainStatus;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now < start) {
    return "pending";
  }

  if (now >= end) {
    return "ended";
  }

  return "active";
}
