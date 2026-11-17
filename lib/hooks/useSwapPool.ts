"use client";

import {
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  AriwaSwapPoolABI,
  IS_SWAP_POOL_CONFIGURED,
  SWAP_POOL_ADDRESS,
} from "@/lib/contracts";

// Runtime-guarded by IS_SWAP_POOL_CONFIGURED, but the hooks need a non-null
// address for the type checker.
const POOL_ADDRESS = SWAP_POOL_ADDRESS as `0x${string}`;

const ONE_ETHER = 10n ** 18n;

/** How often the live reserves and chart refresh while the page is open. */
const LIVE_REFRESH_MS = 1_000;

/** Chart samples move only on trades, so a slower poll is enough. */
const HISTORY_REFRESH_MS = 2_000;

/** The pause flag changes rarely; it does not need the live cadence. */
const PAUSED_REFRESH_MS = 15_000;

/**
 * Live AMM state: both reserves, the current mid price, and the swap fee.
 * Everything is derived on-chain from x * y = k, so the price moves with every
 * buy and sell.
 */
export function useSwapPoolState() {
  const query = useReadContract({
    address: POOL_ADDRESS,
    abi: AriwaSwapPoolABI,
    functionName: "getPoolState",
    query: {
      enabled: IS_SWAP_POOL_CONFIGURED,
      refetchInterval: LIVE_REFRESH_MS,
    },
  });

  const state = query.data as
    | readonly [bigint, bigint, bigint, bigint]
    | undefined;

  const ethReserve = state?.[0];
  const tokenReserve = state?.[1];

  return {
    ethBalance: ethReserve,
    tokenBalance: tokenReserve,
    /** ARIWA per 1 ETH, 18 decimals. */
    tokensPerEth: state?.[2],
    /** ETH per 1 ARIWA, 18 decimals — the price a token chart plots. */
    ethPerToken:
      ethReserve !== undefined && tokenReserve !== undefined && tokenReserve > 0n
        ? (ethReserve * ONE_ETHER) / tokenReserve
        : undefined,
    feeBps: state?.[3],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/** Current mid rate as ARIWA per 1 ETH. */
export function useSwapRate() {
  return useReadContract({
    address: POOL_ADDRESS,
    abi: AriwaSwapPoolABI,
    functionName: "tokensPerEth",
    query: {
      enabled: IS_SWAP_POOL_CONFIGURED,
      refetchInterval: LIVE_REFRESH_MS,
    },
  });
}

/**
 * On-chain price samples used by the trade chart. The contract records a point
 * whenever a trade or liquidity move changes the price.
 */
export function usePriceHistory() {
  return useReadContract({
    address: POOL_ADDRESS,
    abi: AriwaSwapPoolABI,
    functionName: "getPriceHistory",
    query: {
      enabled: IS_SWAP_POOL_CONFIGURED,
      refetchInterval: HISTORY_REFRESH_MS,
    },
  });
}

export function useSwapPoolPaused() {
  return useReadContract({
    address: POOL_ADDRESS,
    abi: AriwaSwapPoolABI,
    functionName: "paused",
    query: {
      enabled: IS_SWAP_POOL_CONFIGURED,
      refetchInterval: PAUSED_REFRESH_MS,
    },
  });
}

/** Live pool reserves, kept as a thin alias for older call sites. */
export function usePoolReserves() {
  const state = useSwapPoolState();
  return {
    ethBalance: state.ethBalance,
    tokenBalance: state.tokenBalance,
    tokensPerEth: state.tokensPerEth,
    isLoading: state.isLoading,
  };
}

export function useBuyAriwa() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const buy = (ethAmount: bigint, minTokensOut: bigint) => {
    writeContract({
      address: POOL_ADDRESS,
      abi: AriwaSwapPoolABI,
      functionName: "buyTokens",
      args: [minTokensOut],
      value: ethAmount,
    });
  };

  return { buy, hash, isPending, isConfirming, isSuccess, error, reset };
}

export function useSellAriwa() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const sell = (tokenAmount: bigint, minEthOut: bigint) => {
    writeContract({
      address: POOL_ADDRESS,
      abi: AriwaSwapPoolABI,
      functionName: "sellTokens",
      args: [tokenAmount, minEthOut],
    });
  };

  return { sell, hash, isPending, isConfirming, isSuccess, error, reset };
}
