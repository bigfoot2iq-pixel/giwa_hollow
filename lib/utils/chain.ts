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

  const client = getPublicClient();

  const responses = await Promise.allSettled(
    chainRaffleIds.map((r) =>
      client.readContract({
        address: contracts.raffles.address,
        abi,
        functionName: "raffles",
        args: [BigInt(r.chainId)],
      })
    )
  );

  for (let i = 0; i < chainRaffleIds.length; i++) {
    const response = responses[i];
    if (response.status === "fulfilled") {
      const data = response.value as [number, string, number, bigint, boolean, boolean, string, bigint];
      const state = Number(data[2]);
      result.set(chainRaffleIds[i].dbId, {
        status: CHAIN_STATE_MAP[state] ?? "pending",
        creator: data[6],
      });
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

  const client = getPublicClient();

  const responses = await Promise.allSettled(
    chainRaffleIds.map((r) =>
      client.readContract({
        address: contracts.raffles.address,
        abi,
        functionName: "raffles",
        args: [BigInt(r.chainId)],
      })
    )
  );

  for (let i = 0; i < chainRaffleIds.length; i++) {
    const response = responses[i];
    if (response.status === "fulfilled") {
      const data = response.value as [number, string, number, bigint, boolean, boolean, string, bigint];
      const state = Number(data[2]);
      result.set(chainRaffleIds[i].dbId, CHAIN_STATE_MAP[state] ?? "pending");
    }
  }

  return result;
}
