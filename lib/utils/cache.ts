/**
 * Cache-Control headers for read-only API routes.
 *
 * Route handlers default to `max-age=0, must-revalidate` on Vercel, so every
 * client poll became its own function invocation. The read routes here are all
 * polled on a timer by the UI, which is what pushed the project past its Fluid
 * Active CPU allowance — the fix is to let the CDN absorb the polls.
 *
 * `max-age` collapses repeat polls from one browser; `s-maxage` collapses them
 * across all browsers at the edge; `stale-while-revalidate` keeps the edge
 * serving instantly while a single background invocation refreshes it. So N
 * users polling every 30s cost one invocation per `s-maxage` window, not N.
 */

interface CachePolicy {
  /** Browser cache lifetime, seconds. Keep at or below the UI poll interval. */
  browser: number;
  /** Shared/CDN cache lifetime, seconds. */
  cdn: number;
  /** How long the edge may serve stale while revalidating, seconds. */
  swr?: number;
  /** Keep the response out of shared caches (per-user data). */
  private?: boolean;
}

export function cacheControl(policy: CachePolicy): string {
  const parts = [
    policy.private ? "private" : "public",
    `max-age=${policy.browser}`,
  ];
  if (!policy.private) {
    parts.push(`s-maxage=${policy.cdn}`);
    if (policy.swr !== undefined) parts.push(`stale-while-revalidate=${policy.swr}`);
  }
  return parts.join(", ");
}

/**
 * Named policies, kept together so the cost/staleness tradeoff for the whole
 * API is visible in one place rather than scattered across route files.
 */
export const CACHE = {
  /** Holder list: walks the explorer, by far the most expensive read we serve. */
  holders: cacheControl({ browser: 60, cdn: 300, swr: 600 }),
  /** Game leaderboard: a single Postgres RPC, polled from the leaderboard tab. */
  leaderboard: cacheControl({ browser: 30, cdn: 60, swr: 300 }),
  /** Raffle list: on-chain fan-out + entry reconciliation. Highest traffic route. */
  raffles: cacheControl({ browser: 10, cdn: 30, swr: 120 }),
  /** Single raffle detail. */
  raffleDetail: cacheControl({ browser: 10, cdn: 30, swr: 120 }),
  /** Config values change only when an admin edits them. */
  config: cacheControl({ browser: 300, cdn: 3600, swr: 86400 }),
  /** Upstream price feed is already minute-resolution. */
  tokenPrices: cacheControl({ browser: 30, cdn: 60, swr: 300 }),
  /**
   * Admin check is keyed by wallet. Private so per-wallet answers never land in
   * a shared cache — the browser cache alone removes almost all of these,
   * since the sidebar asks on every full page load.
   */
  adminAccess: cacheControl({ browser: 300, cdn: 0, private: true }),
} as const;
