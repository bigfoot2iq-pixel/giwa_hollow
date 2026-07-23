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

export function useCategoryAmount(categoryId: number) {
  return useReadContract({
    address: contracts.hollowToken.address,
    abi: HollowTokenABI,
    functionName: "getCategoryAmount",
    args: [categoryId],
    query: {
      enabled: categoryId >= 0 && categoryId < 4,
    },
  });
}

export function useCategoryFee(categoryId: number) {
  return useReadContract({
    address: contracts.hollowToken.address,
    abi: HollowTokenABI,
    functionName: "getCategoryFee",
    args: [categoryId],
    query: {
      enabled: categoryId >= 0 && categoryId < 4,
    },
  });
}

export function useCategoryName(categoryId: number) {
  return useReadContract({
    address: contracts.hollowToken.address,
    abi: HollowTokenABI,
    functionName: "getCategoryName",
    args: [categoryId],
    query: {
      enabled: categoryId >= 0 && categoryId < 4,
    },
  });
}

export function useClaimTokens() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const claimTokens = (categoryId: number, fee: bigint) => {
    writeContract({
      address: contracts.hollowToken.address,
      abi: HollowTokenABI,
      functionName: "claimTokens",
      args: [categoryId],
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
