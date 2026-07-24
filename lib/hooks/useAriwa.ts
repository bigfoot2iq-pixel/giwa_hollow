"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { contracts, AriwaTokenABI } from "@/lib/contracts";

export function useCanClaim(address: `0x${string}` | undefined) {
  return useReadContract({
    address: contracts.ariwaToken.address,
    abi: AriwaTokenABI,
    functionName: "canClaim",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

export function useClaimCooldown() {
  return useReadContract({
    address: contracts.ariwaToken.address,
    abi: AriwaTokenABI,
    functionName: "claimCooldown",
  });
}

export function useGetLastClaimTimestamp(address: `0x${string}` | undefined) {
  return useReadContract({
    address: contracts.ariwaToken.address,
    abi: AriwaTokenABI,
    functionName: "getLastClaimTimestamp",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

export function useAriwaBalance(address: `0x${string}` | undefined) {
  return useReadContract({
    address: contracts.ariwaToken.address,
    abi: AriwaTokenABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

export function useClaimAmount() {
  return useReadContract({
    address: contracts.ariwaToken.address,
    abi: AriwaTokenABI,
    functionName: "claimAmount",
  });
}

export function useClaimFee() {
  return useReadContract({
    address: contracts.ariwaToken.address,
    abi: AriwaTokenABI,
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
      address: contracts.ariwaToken.address,
      abi: AriwaTokenABI,
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
