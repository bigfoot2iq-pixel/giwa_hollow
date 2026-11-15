"use client";

import {
  useBalance,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  AriwaSwapPoolABI,
  AriwaTokenABI,
  contracts,
  IS_SWAP_POOL_CONFIGURED,
  SWAP_POOL_ADDRESS,
} from "@/lib/contracts";

// Runtime-guarded by IS_SWAP_POOL_CONFIGURED, but the hooks need a non-null
// address for the type checker.
const POOL_ADDRESS = SWAP_POOL_ADDRESS as `0x${string}`;

export function useSwapRate() {
  return useReadContract({
    address: POOL_ADDRESS,
    abi: AriwaSwapPoolABI,
    functionName: "tokensPerEth",
    query: { enabled: IS_SWAP_POOL_CONFIGURED },
  });
}

export function useSwapPoolPaused() {
  return useReadContract({
    address: POOL_ADDRESS,
    abi: AriwaSwapPoolABI,
    functionName: "paused",
    query: { enabled: IS_SWAP_POOL_CONFIGURED },
  });
}

/** Live pool reserves: ETH held by the contract and its ARIWA balance. */
export function usePoolReserves() {
  const eth = useBalance({
    address: POOL_ADDRESS,
    query: { enabled: IS_SWAP_POOL_CONFIGURED },
  });

  const tokens = useReadContract({
    address: contracts.ariwaToken.address,
    abi: AriwaTokenABI,
    functionName: "balanceOf",
    args: [POOL_ADDRESS],
    query: {
      enabled: IS_SWAP_POOL_CONFIGURED && Boolean(contracts.ariwaToken.address),
    },
  });

  return {
    ethBalance: eth.data?.value,
    tokenBalance: tokens.data as bigint | undefined,
    isLoading: eth.isLoading || tokens.isLoading,
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
