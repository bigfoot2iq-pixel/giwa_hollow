"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatEther } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useCanClaim,
  useClaimTokens,
  useClaimCooldown,
  useGetLastClaimTimestamp,
  useClaimAmount,
  useClaimFee,
  formatTokenBalance
} from "@/lib/hooks";

function formatCooldownLabel(seconds: number): string {
  if (seconds >= 86400) {
    const days = Math.floor(seconds / 86400);
    return days === 1 ? "day" : `${days} days`;
  }
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    return hours === 1 ? "hr" : `${hours} hrs`;
  }
  if (seconds < 60) {
    return seconds === 1 ? "1 second" : `${seconds} seconds`;
  }
  const mins = Math.floor(seconds / 60);
  return mins === 1 ? "min" : `${mins} mins`;
}

function isCooldownError(error: Error): boolean {
  const msg = (error as any).shortMessage ?? error.message ?? "";
  return /cooldown|too soon|wait|claim.*early/i.test(msg);
}

function isUserRejection(error: Error): boolean {
  const msg = (error as any).shortMessage ?? error.message ?? "";
  return /user rejected|user denied|rejected the request/i.test(msg);
}

export default function ClaimPage() {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();

  const { data: canClaim, isLoading: isCheckingClaim } = useCanClaim(address);
  const { data: lastClaimTimestamp } = useGetLastClaimTimestamp(address);
  const { data: claimCooldown } = useClaimCooldown();
  const { data: claimAmount } = useClaimAmount();
  const { data: claimFee } = useClaimFee();
  const { claimTokens, isPending, isConfirming, isSuccess, error, reset } = useClaimTokens();

  const amountValue = claimAmount as bigint | undefined;
  const feeValue = claimFee as bigint | undefined;

  const cooldownSeconds = claimCooldown ? Number(claimCooldown) : 43200; // 12h default until on-chain value loads
  const cooldownLabel = formatCooldownLabel(cooldownSeconds);

  const handleClaim = () => {
    if (feeValue === undefined) {
      toast.error("Fee not loaded yet.");
      return;
    }

    if (lastClaimTimestamp) {
      const lastClaimTime = Number(lastClaimTimestamp);
      if (lastClaimTime > 0) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const remaining = (lastClaimTime + cooldownSeconds) - nowSeconds;
        if (remaining > 0) {
          const label = formatCooldownLabel(remaining);
          toast.warning(`Cooldown active — try again in ${label}.`);
          return;
        }
      }
    }

    claimTokens(feeValue);
  };

  useEffect(() => {
    if (!isSuccess) return;
    toast.success("Tokens claimed successfully!");
    // Refresh header balance + claim state now, then retry a few times. The RPC
    // node serving `balanceOf` can lag the just-mined block, so a single refetch
    // may grab the pre-mint value and stick until a manual page refresh.
    // Fire-and-forget timers: reset() below flips isSuccess false and would tear
    // down any cleanup-bound retry before it runs.
    queryClient.invalidateQueries();
    [1500, 4000, 8000].forEach((ms) =>
      setTimeout(() => queryClient.invalidateQueries(), ms)
    );
    reset();
  }, [isSuccess, queryClient, reset]);

  useEffect(() => {
    if (!error) return;

    if (isUserRejection(error)) {
      // User rejected in wallet — no toast needed
    } else if (isCooldownError(error)) {
      toast.warning("Cooldown active — please wait before claiming again.");
    } else {
      toast.error(error.message || "Something went wrong.");
    }
    reset();
  }, [error, reset]);

  const isProcessing = isPending || isConfirming;
  const onCooldown = canClaim === false;

  const utilities = [
    { icon: "swap_horiz", text: "ARIWA is fully tradable — transfer and exchange freely." },
    { icon: "confirmation_number", text: "Create and join raffles using ARIWA tokens." },
    { icon: "redeem", text: "Unlock free mints and exclusive drops." },
    { icon: "sports_esports", text: "Play games and compete on the leaderboard." },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-8 lg:py-12">
      <div className="w-full max-w-5xl">
        <div className="ui-container rounded-2xl p-6 sm:p-8 lg:p-10 w-full">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
            {/* Left Side - Claim */}
            <div className="flex flex-1 flex-col">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-accent-warm/15">
                  <span className="material-symbols-outlined text-accent-warm" style={{ fontSize: 24 }}>redeem</span>
                </div>
                <h1 className="text-2xl font-header text-text-primary sm:text-3xl">Claim ARIWA Tokens</h1>
              </div>

              <p className="mb-6 max-w-md text-sm text-muted-blue sm:text-base">
                Pay the fee and mint ARIWA tokens. Tokens are transferable and unlock raffles and future drops.
              </p>

              {/* Claim summary — stat tiles */}
              <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4">
                <div className="rounded-xl border border-black/10 p-4">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-blue">You Receive</span>
                  <span className="mt-2 block font-display text-xl font-bold text-text-primary sm:text-2xl">
                    {amountValue !== undefined ? formatTokenBalance(amountValue) : "…"}
                    <span className="ml-1.5 text-xs font-semibold text-muted-blue">ARIWA</span>
                  </span>
                </div>
                <div className="rounded-xl border border-black/10 p-4">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-blue">Mint Fee</span>
                  <span className="mt-2 block font-display text-xl font-bold text-accent-warm sm:text-2xl">
                    {feeValue !== undefined ? formatEther(feeValue) : "…"}
                    <span className="ml-1.5 text-xs font-semibold text-muted-blue">ETH</span>
                  </span>
                </div>
              </div>

              {/* Claim / Connect Wallet Button */}
              <div className="mt-auto">
                {isConnected ? (
                  <button
                    onClick={handleClaim}
                    disabled={isProcessing || isCheckingClaim || onCooldown}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent-warm text-sm font-bold uppercase tracking-[0.15em] text-background transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100 disabled:active:scale-100"
                  >
                    {isProcessing ? (
                      <span className="material-symbols-outlined animate-spin" style={{ fontSize: 20 }}>progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{onCooldown ? "schedule" : "bolt"}</span>
                    )}
                    {isPending ? "Confirm in Wallet…" : isConfirming ? "Claiming…" : onCooldown ? "Cooldown Active" : "Claim Tokens"}
                  </button>
                ) : (
                  <ConnectButton.Custom>
                    {({ openConnectModal, openChainModal, chain, mounted }) => {
                      if (!mounted) return null;
                      if (chain?.unsupported) {
                        return (
                          <button
                            onClick={openChainModal}
                            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-red-500 text-sm font-bold uppercase tracking-[0.15em] text-white transition-all hover:brightness-110"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>error</span>
                            Wrong Network
                          </button>
                        );
                      }
                      return (
                        <button
                          onClick={openConnectModal}
                          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent-warm text-sm font-bold uppercase tracking-[0.15em] text-background transition-all hover:brightness-110 active:scale-[0.99]"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>account_balance_wallet</span>
                          Connect Wallet
                        </button>
                      );
                    }}
                  </ConnectButton.Custom>
                )}

                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-blue">
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>schedule</span>
                  <span>
                    Claim once every <span className="font-bold text-text-primary">{cooldownLabel}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Vertical Separator */}
            <div className="hidden w-px bg-black/10 lg:block" />

            {/* Right Side - Utility */}
            <div className="flex-shrink-0 lg:w-72">
              <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-blue">ARIWA Utility</h2>
              <div className="space-y-3">
                {utilities.map((u) => (
                  <div key={u.icon} className="flex items-start gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-accent-warm/15 text-accent-warm">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{u.icon}</span>
                    </span>
                    <p className="pt-1 text-xs leading-relaxed text-muted-blue">{u.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
