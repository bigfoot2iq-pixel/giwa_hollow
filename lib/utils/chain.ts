import { createPublicClient, http, type Abi } from "viem";
import { contracts, giwaSepolia, RobinhoodRafflesABI } from "@/lib/contracts";
import type { RaffleStatus } from "@/lib/supabase";

// On-chain RaffleState enum: CREATED=0, ACTIVE=1, COMPLETED=2, CANCELLED=3
const CHAIN_STATE_MAP: Record<number, RaffleStatus> = {
  0: "pending",
  1: "active",
  2: "ended",
  3: "ended",
};

const abi = RobinhoodRafflesABI as Abi;

function getPublicClient() {
  const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rpc.giwa.io";
  return createPublicClient({
    chain: giwaSepolia,
    transport: http(rpcUrl),
  });
}

/** Read on-chain state for a single raffle */
export async function getOnChainRaffleState(chainRaffleId: number): Promise<RaffleStatus> {
  const client = getPublicClient();
  const result = await client.readContract({
    address: contracts.raffles.address,
    abi,
    functionName: "raffles",
    args: [BigInt(chainRaffleId)],
  }) as [number, string, number, bigint, boolean, boolean, string, bigint];

  const state = Number(result[2]);
  return CHAIN_STATE_MAP[state] ?? "pending";
}

export interface OnChainRaffleSchedule {
  status: RaffleStatus;
  // Unix seconds after which the contract allows endRaffle. 0 = owner-managed,
  // endable anytime. Non-zero = scheduled raffle; endRaffle reverts "Raffle not
  // yet ended" until block.timestamp >= endTime (anti-rug).
  endTime: number;
}

/** Read on-chain state + schedule for a single raffle in one struct read. */
export async function getOnChainRaffleSchedule(
  chainRaffleId: number
): Promise<OnChainRaffleSchedule> {
  const client = getPublicClient();
  const result = await client.readContract({
    address: contracts.raffles.address,
    abi,
    functionName: "raffles",
    args: [BigInt(chainRaffleId)],
  }) as [number, string, number, bigint, boolean, boolean, string, bigint];

  const state = Number(result[2]);
  return {
    status: CHAIN_STATE_MAP[state] ?? "pending",
    endTime: Number(result[7]),
  };
}

// address(0) creator on-chain = owner/platform raffle; otherwise a user raffle.
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export interface OnChainRaffleMeta {
  status: RaffleStatus;
  creator: string;
}

// The list route fans out one `raffles(uint256)` read per row. On a cold
// instance with a few hundred raffles that is a burst of RPC calls for data
// that only changes when an admin or the watchdog acts. A short per-instance
// TTL collapses repeat requests; the host-level CDN cache handles the rest.
const META_CACHE_TTL_MS = 20_000;
const META_CACHE_MAX_ENTRIES = 1_000;
const metaCache = new Map<number, { meta: OnChainRaffleMeta; at: number }>();
const stateCache = new Map<number, { status: RaffleStatus; at: number }>();

function readCachedMeta(chainId: number): OnChainRaffleMeta | undefined {
  const hit = metaCache.get(chainId);
  if (!hit) return undefined;
  if (Date.now() - hit.at > META_CACHE_TTL_MS) {
    metaCache.delete(chainId);
    return undefined;
  }
  return hit.meta;
}

function writeCachedMeta(chainId: number, meta: OnChainRaffleMeta) {
  metaCache.set(chainId, { meta, at: Date.now() });
  if (metaCache.size > META_CACHE_MAX_ENTRIES) {
    const oldest = metaCache.keys().next().value;
    if (oldest !== undefined) metaCache.delete(oldest);
  }
}

function readCachedState(chainId: number): RaffleStatus | undefined {
  const hit = stateCache.get(chainId);
  if (!hit) return undefined;
  if (Date.now() - hit.at > META_CACHE_TTL_MS) {
    stateCache.delete(chainId);
    return undefined;
  }
  return hit.status;
}

function writeCachedState(chainId: number, status: RaffleStatus) {
  stateCache.set(chainId, { status, at: Date.now() });
  if (stateCache.size > META_CACHE_MAX_ENTRIES) {
    const oldest = stateCache.keys().next().value;
    if (oldest !== undefined) stateCache.delete(oldest);
  }
}

/**
 * Batch read on-chain state + creator for multiple raffles via parallel calls.
 * The `raffles` mapping getter returns the full struct; index 2 = state, index 6 = creator.
 * creator === ZERO_ADDRESS means a platform (owner) raffle; otherwise community (user) raffle.
 */
export async function getOnChainRaffleMeta(
  chainRaffleIds: { dbId: string; chainId: number }[]
): Promise<Map<string, OnChainRaffleMeta>> {
  const result = new Map<string, OnChainRaffleMeta>();
  if (chainRaffleIds.length === 0) return result;

  const missing: { dbId: string; chainId: number }[] = [];
  for (const raffle of chainRaffleIds) {
    const cached = readCachedMeta(raffle.chainId);
    if (cached) result.set(raffle.dbId, cached);
    else missing.push(raffle);
  }

  if (missing.length === 0) return result;

  const client = getPublicClient();

  const responses = await Promise.allSettled(
    missing.map((r) =>
      client.readContract({
        address: contracts.raffles.address,
        abi,
        functionName: "raffles",
        args: [BigInt(r.chainId)],
      })
    )
  );

  for (let i = 0; i < missing.length; i++) {
    const response = responses[i];
    if (response.status === "fulfilled") {
      const data = response.value as [number, string, number, bigint, boolean, boolean, string, bigint];
      const state = Number(data[2]);
      const meta = {
        status: CHAIN_STATE_MAP[state] ?? "pending",
        creator: data[6],
      } satisfies OnChainRaffleMeta;
      writeCachedMeta(missing[i].chainId, meta);
      result.set(missing[i].dbId, meta);
    }
  }

  return result;
}

/** Batch read on-chain state for multiple raffles via parallel calls */
export async function getOnChainRaffleStates(
  chainRaffleIds: { dbId: string; chainId: number }[]
): Promise<Map<string, RaffleStatus>> {
  const result = new Map<string, RaffleStatus>();
  if (chainRaffleIds.length === 0) return result;

  const missing: { dbId: string; chainId: number }[] = [];
  for (const raffle of chainRaffleIds) {
    const cached = readCachedState(raffle.chainId);
    if (cached) result.set(raffle.dbId, cached);
    else missing.push(raffle);
  }

  if (missing.length === 0) return result;

  const client = getPublicClient();

  const responses = await Promise.allSettled(
    missing.map((r) =>
      client.readContract({
        address: contracts.raffles.address,
        abi,
        functionName: "raffles",
        args: [BigInt(r.chainId)],
      })
    )
  );

  for (let i = 0; i < missing.length; i++) {
    const response = responses[i];
    if (response.status === "fulfilled") {
      const data = response.value as [number, string, number, bigint, boolean, boolean, string, bigint];
      const state = Number(data[2]);
      const status = CHAIN_STATE_MAP[state] ?? "pending";
      writeCachedState(missing[i].chainId, status);
      result.set(missing[i].dbId, status);
    }
  }

  return result;
}
