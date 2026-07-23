"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther, parseEther } from "viem";
import { contracts, HollowTokenABI } from "@/lib/contracts";

export function useTokenBalance(address: `0x${string}` | undefined) {
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

export function useTokenAllowance(owner: `0x${string}` | undefined, spender: `0x${string}`) {
  return useReadContract({
    address: contracts.hollowToken.address,
    abi: HollowTokenABI,
    functionName: "allowance",
    args: owner ? [owner, spender] : undefined,
    query: {
      enabled: !!owner,
    },
  });
}

export function useApproveTokens() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const approve = async (spender: `0x${string}`, amount: bigint) => {
    writeContract({
      address: contracts.hollowToken.address,
      abi: HollowTokenABI,
      functionName: "approve",
      args: [spender, amount],
      gas: 100000n,
    });
  };

  return {
    approve,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export { formatEther, parseEther };

export function formatTokenBalance(balance: bigint | undefined): string {
  if (balance === undefined) return "0.00";
  return parseFloat(formatEther(balance)).toFixed(2);
}
