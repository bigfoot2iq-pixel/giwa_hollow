"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, usePublicClient, useWriteContract, useReadContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useTokenAllowance, useTokenBalance, formatTokenBalance } from "@/lib/hooks";
import { contracts, RobinhoodRafflesABI, AriwaTokenABI } from "@/lib/contracts";
import type { Raffle } from "@/lib/supabase";
import { getTokenMetadataCached } from "@/lib/utils/erc20";

interface RaffleEntryFormProps {
  raffle: Raffle;
  chainRaffleId: number;
  participantsCount?: number;
  onSuccess?: () => void;
}

type EntryStatus = "idle" | "approving" | "joining" | "recording" | "success" | "error";

export function RaffleEntryForm({
  raffle,
  chainRaffleId,
  participantsCount,
  onSuccess,
}: RaffleEntryFormProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const [entryCount, setEntryCount] = useState(1);
  const [enteredCount, setEnteredCount] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [status, setStatus] = useState<EntryStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState<string>("ARIWA");

  const tokensNeeded = BigInt(entryCount * raffle.tokens_required) * BigInt(10 ** 18);

  const { data: allowance, refetch: refetchAllowance } = useTokenAllowance(address, contracts.raffles.address);
  const { data: balance } = useTokenBalance(address);

  // Fetch on-chain raffle state
  const { data: raffleInfo } = useReadContract({
    address: contracts.raffles.address,
    abi: RobinhoodRafflesABI,
    functionName: "getRaffleInfo",
    args: [BigInt(chainRaffleId)],
    query: {
      enabled: chainRaffleId > 0,
      refetchInterval: 10000, // Refetch every 10 seconds
    },
  });

  // On-chain state: CREATED=0, ACTIVE=1, COMPLETED=2, CANCELLED=3
  // getRaffleInfo returns: [prizeType, prizeToken, prizeCount, state, isNFT, hasWinners]
  const onChainState = raffleInfo ? Number((raffleInfo as readonly [number, string, bigint, number, boolean, boolean])[3]) : null;
  const isOnChainActive = onChainState === 1;

  const hasInsufficientBalance = balance !== undefined && balance < tokensNeeded;

  // Fetch token symbol
  useEffect(() => {
    const fetchTokenSymbol = async () => {
      const metadata = await getTokenMetadataCached(contracts.ariwaToken.address, false);
      if (metadata) {
        setTokenSymbol(metadata.symbol);
      }
    };
    fetchTokenSymbol();
  }, []);

  /**
   * Reads how many entries this wallet already has.
   *
   * `fresh` skips the browser cache. The route is cached to keep it off
   * Postgres, but the read after a successful entry is the one moment the value
   * is guaranteed to have just changed.
   */
  const fetchEnteredCount = useCallback(
    async (opts: { fresh?: boolean; signal?: AbortSignal } = {}): Promise<number> => {
      if (!address || !raffle.id) return 0;
      try {
        const response = await fetch(
          `/api/entries?raffleId=${raffle.id}&walletAddress=${address}`,
          { signal: opts.signal, cache: opts.fresh ? "no-store" : "default" }
        );
        const count = response.ok
          ? Number((await response.json())?.entryCount) || 0
          : 0;
        setEnteredCount(count);
        return count;
      } catch {
        setEnteredCount(0);
        return 0;
      }
    },
    [address, raffle.id]
  );

  // Deferred until the wallet actually engages with the form.
  //
  // This read is per-wallet, so it can never be cached across users — every
  // request is a distinct Supabase round trip by construction. Firing it on
  // mount meant one round trip per page view, and the overwhelming majority of
  // page views are automated traffic that never touches the form. Waiting for
  // real intent removes those without changing anything a real entrant sees:
  // `handleSubmit` loads the count itself before going on-chain.
  const [entryFormEngaged, setEntryFormEngaged] = useState(false);

  useEffect(() => {
    setEnteredCount(null);
    setEntryFormEngaged(false);
  }, [address, raffle.id]);

  useEffect(() => {
    if (!entryFormEngaged || !address || !raffle.id) return;
    const controller = new AbortController();
    fetchEnteredCount({ fresh: refreshKey > 0, signal: controller.signal });
    return () => controller.abort();
  }, [entryFormEngaged, address, raffle.id, refreshKey, fetchEnteredCount]);

  const needsApproval = allowance !== undefined && allowance < tokensNeeded;
  const isLoading = status === "approving" || status === "joining" || status === "recording";

  const currentEnteredCount = enteredCount ?? 0;
  const maxEntries = raffle.max_entries_per_user - currentEnteredCount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address || !publicClient) return;

    setStatus("idle");
    setError(null);

    try {
      // The on-screen cap is optimistic until the deferred read lands, and every
      // step below this line costs real tokens. Settle the count against the
      // server first — the POST that records the entry enforces the same limit,
      // and hitting it after joinRaffle would take the tokens without an entry.
      const alreadyEntered = enteredCount ?? (await fetchEnteredCount({ fresh: true }));
      if (alreadyEntered + entryCount > raffle.max_entries_per_user) {
        const remaining = Math.max(0, raffle.max_entries_per_user - alreadyEntered);
        setStatus("error");
        setError(
          remaining === 0
            ? "You have reached the maximum entries for this raffle."
            : `You can only enter ${remaining} more time${remaining === 1 ? "" : "s"}.`
        );
        setEntryCount(Math.max(1, Math.min(entryCount, remaining || 1)));
        return;
      }

      // Step 1: Approve if needed
      if (needsApproval) {
        setStatus("approving");
        const approveHash = await writeContractAsync({
          address: contracts.ariwaToken.address,
          abi: AriwaTokenABI,
          functionName: "approve",
          args: [contracts.raffles.address, tokensNeeded],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        await refetchAllowance();
      }

      // Step 2: Join raffle on-chain
      setStatus("joining");
      const joinHash = await writeContractAsync({
        address: contracts.raffles.address,
        abi: RobinhoodRafflesABI,
        functionName: "joinRaffle",
        args: [BigInt(chainRaffleId), tokensNeeded],
      });

      // Wait for transaction and verify it was successful
      const receipt = await publicClient.waitForTransactionReceipt({ hash: joinHash });

      if (receipt.status !== "success") {
        throw new Error("Transaction failed on-chain. Entry was not recorded.");
      }

      // Step 3: Record entry in database (only if transaction succeeded)
      setStatus("recording");
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raffleId: raffle.id,
          walletAddress: address,
          tokensSpent: entryCount * raffle.tokens_required,
          entryCount,
          txHash: joinHash,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || "Failed to record entry");
      }

      setStatus("success");
      setRefreshKey((prev) => prev + 1);
      // Invalidate token balance so Header updates immediately
      await queryClient.invalidateQueries({ queryKey: ["readContract"] });
      onSuccess?.();
    } catch (err: unknown) {
      setStatus("error");
      const message =
        (err as { shortMessage?: string })?.shortMessage ||
        (err as Error)?.message ||
        "Something went wrong";
      setError(message);
    }
  };

  if (!isConnected) {
    return (
      <div className="text-center py-6">
        <span className="material-symbols-outlined text-muted-blue text-4xl mb-2 block">account_balance_wallet</span>
        <p className="text-muted-blue">Connect your wallet to enter this raffle</p>
      </div>
    );
  }

  // Check on-chain state first (most important)
  if (onChainState !== null && !isOnChainActive) {
    const stateMessage =
      onChainState === 0 ? "This raffle has not started yet on-chain" :
        onChainState === 2 ? "This raffle has been completed" :
          onChainState === 3 ? "This raffle has been cancelled" :
            "This raffle is not currently active on-chain";

    return (
      <div className="text-center py-6">
        <span className="material-symbols-outlined text-red-400 text-4xl mb-2 block">block</span>
        <p className="text-muted-blue">{stateMessage}</p>
        <p className="text-xs text-muted-blue/60 mt-2">On-chain state: {onChainState}</p>
      </div>
    );
  }

  const now = new Date();
  const isActive = now >= new Date(raffle.start_date) && now < new Date(raffle.end_date);

  if (!isActive) {
    return (
      <div className="text-center py-6">
        <span className="material-symbols-outlined text-muted-blue text-4xl mb-2 block">schedule</span>
        <p className="text-muted-blue">This raffle is not currently active</p>
      </div>
    );
  }

  if (participantsCount !== undefined && participantsCount >= raffle.max_participants) {
    return (
      <div className="text-center py-6">
        <span className="material-symbols-outlined text-muted-blue text-4xl mb-2 block">group</span>
        <p className="text-muted-blue">This raffle has reached the maximum participants</p>
      </div>
    );
  }

  if (maxEntries <= 0) {
    return (
      <div className="text-center py-6">
        <span className="material-symbols-outlined text-[#0062df] text-4xl mb-2 block">check_circle</span>
        <p className="text-muted-blue">You have reached the maximum entries for this raffle</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      // First real interaction anywhere in the form triggers the deferred
      // entry-count read, so it is already in flight by the time anyone submits.
      // Capture phase, and both events, so focusing the input and clicking the
      // button are each enough on their own.
      onFocusCapture={() => setEntryFormEngaged(true)}
      onPointerDownCapture={() => setEntryFormEngaged(true)}
      className="space-y-6"
    >
      <div>
        <label className="text-[10px] font-bold uppercase text-muted-blue tracking-widest block mb-2">
          Number of Entries
        </label>
        <input
          type="number"
          min={1}
          max={maxEntries}
          value={entryCount}
          onChange={(e) => setEntryCount(Math.max(1, Math.min(maxEntries, parseInt(e.target.value) || 1)))}
          className="w-full bg-dark-navy border border-black/10 rounded px-4 py-3 text-text-primary text-lg font-display font-bold focus:outline-none focus:ring-1 focus:ring-[#0062df]"
        />
        <p className="text-xs text-muted-blue mt-2">
          Max {maxEntries} entries remaining
        </p>
      </div>

      <div className="p-4 bg-dark-navy rounded border border-black/10 space-y-2">
        <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-blue">
          <span>Entry Cost</span>
          <span className="text-text-primary">{raffle.tokens_required} {tokenSymbol}</span>
        </div>
        <div className="h-[1px] bg-black/10"></div>
        <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-blue">
          <span>Total</span>
          <span className="text-[#0062df]">{entryCount * raffle.tokens_required} {tokenSymbol}</span>
        </div>
        {balance !== undefined && (
          <>
            <div className="h-[1px] bg-black/10"></div>
            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-blue">
              <span>Your Balance</span>
              <span className={hasInsufficientBalance ? "text-red-400" : "text-text-primary"}>
                {formatTokenBalance(balance)} {tokenSymbol}
              </span>
            </div>
          </>
        )}
      </div>

      {hasInsufficientBalance && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded text-amber-400 text-sm text-center flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-lg">warning</span>
          <span>Insufficient balance. You need {entryCount * raffle.tokens_required} {tokenSymbol} to enter.</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || hasInsufficientBalance}
        className="w-full py-4 bg-accent-warm hover:brightness-110 text-background font-bold rounded uppercase tracking-[0.15em] text-sm transition-all shadow-[0_0_20px_rgba(0,98,223,0.25)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading && (
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {status === "approving"
          ? "Approving Tokens..."
          : status === "joining"
            ? "Joining Raffle..."
            : status === "recording"
              ? "Recording Entry..."
              : "Enter Raffle"}
      </button>

      {status === "success" && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-500 text-sm text-center">
          Successfully entered the raffle!
        </div>
      )}

      {status === "error" && error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm text-center">
          {error}
        </div>
      )}
    </form>
  );
}
