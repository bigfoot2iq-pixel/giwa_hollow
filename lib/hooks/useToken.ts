"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther, parseEther } from "viem";
import { contracts, AriwaTokenABI } from "@/lib/contracts";
import { formatCompactNumber } from "@/lib/utils/format";

export function useTokenBalance(address: `0x${string}` | undefined) {
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

export function useTokenAllowance(owner: `0x${string}` | undefined, spender: `0x${string}`) {
  return useReadContract({
    address: contracts.ariwaToken.address,
    abi: AriwaTokenABI,
    functionName: "allowance",
    args: owner ? [owner, spender] : undefined,
    query: {
      enabled: !!owner,
    },
  });
}

export function useApproveTokens() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const approve = async (spender: `0x${string}`, amount: bigint) => {
    writeContract({
      address: contracts.ariwaToken.address,
      abi: AriwaTokenABI,
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
    reset,
  };
}

export { formatEther, parseEther };

export function formatTokenBalance(balance: bigint | undefined): string {
  if (balance === undefined) return "0.00";
  return formatCompactNumber(formatEther(balance), {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    fallback: "0.00",
  });
}

/**
 * Shorten a token balance for tight spots like the header pill, where
 * "99851034.97 ARIWA" would look padded. Becomes "99.9M ARIWA".
 * Below 1,000 it keeps the same two decimals as formatTokenBalance.
 */
export function formatCompactBalance(balance: bigint | undefined): string {
  if (balance === undefined) return "0";
  const value = parseFloat(formatEther(balance));
  if (!Number.isFinite(value) || value === 0) return "0";

  return formatCompactNumber(value, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    fallback: "0",
  });
}
