"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther, parseEther } from "viem";
import { contracts, AriwaTokenABI } from "@/lib/contracts";

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
  return parseFloat(formatEther(balance)).toFixed(2);
}

const COMPACT_UNITS = [
  { size: 1e15, suffix: "Q" },
  { size: 1e12, suffix: "T" },
  { size: 1e9, suffix: "B" },
  { size: 1e6, suffix: "M" },
  { size: 1e3, suffix: "K" },
] as const;

function trimTrailingZeros(fixed: string): string {
  if (!fixed.includes(".")) return fixed;
  return fixed.replace(/0+$/, "").replace(/\.$/, "");
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

  let index = COMPACT_UNITS.findIndex((unit) => Math.abs(value) >= unit.size);
  if (index === -1) return value.toFixed(2);

  // Rounding can push 999,500 up to "1000K", so step up a unit when that happens.
  for (; index >= 0; index -= 1) {
    const scaled = value / COMPACT_UNITS[index].size;
    const magnitude = Math.abs(scaled);
    const digits = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : 2;
    const rounded = trimTrailingZeros(scaled.toFixed(digits));
    if (Math.abs(Number(rounded)) < 1000) {
      return `${rounded}${COMPACT_UNITS[index].suffix}`;
    }
  }

  return Math.round(value).toLocaleString("en-US");
}
