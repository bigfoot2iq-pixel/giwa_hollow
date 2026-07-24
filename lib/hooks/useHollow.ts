"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { contracts, HollowTokenABI } from "@/lib/contracts";

export function useCanClaim(address: `0x${string}` | undefined) {
  return useReadContract({
    address: contracts.hollowToken.address,
    abi: HollowTokenABI,
    functionName: "canClaim",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

export function useClaimCooldown() {
  return useReadContract({
    address: contracts.hollowToken.address,
    abi: HollowTokenABI,
    functionName: "claimCooldown",
  });
}

export function useGetLastClaimTimestamp(address: `0x${string}` | undefined) {
  return useReadContract({
    address: contracts.hollowToken.address,
    abi: HollowTokenABI,
    functionName: "getLastClaimTimestamp",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

export function useHollowBalance(address: `0x${string}` | undefined) {
  return useReadContract({
    address: contracts.hollowToken.address,
    abi: HollowTokenABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

export function useClaimAmount() {
  return useReadContract({
    address: contracts.hollowToken.address,
    abi: HollowTokenABI,
    functionName: "claimAmount",
  });
}

export function useClaimFee() {
  return useReadContract({
    address: contracts.hollowToken.address,
    abi: HollowTokenABI,
    functionName: "claimFee",
  });
}

export function useClaimTokens() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const claimTokens = (fee: bigint) => {
    writeContract({
      address: contracts.hollowToken.address,
      abi: HollowTokenABI,
      functionName: "claimTokens",
      args: [],
      value: fee,
      gas: 500000n,
    });
  };

  return {
    claimTokens,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}
