"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { formatCount, type MintValues } from "./launchpad-format";

export type MintAction = {
  label: string;
  disabled: boolean;
  icon: ReactNode;
  onClick: () => void;
  countdown?: boolean;
};

/**
 * The only action surface on the page: the mint button and the wallet's own
 * mint counter, so the visitor can see how close they are to their limit.
 */
export function LaunchpadMintActions({
  action,
  values,
  walletMinted,
  connected,
}: {
  action: MintAction;
  values?: MintValues;
  walletMinted: bigint;
  connected: boolean;
}) {
  const walletLimit = values?.walletLimit ?? 0n;
  const showWalletProgress =
    connected && values !== undefined && walletLimit > 0n;
  const walletProgress =
    showWalletProgress && walletMinted > 0n
      ? Math.min(100, (Number(walletMinted) / Number(walletLimit)) * 100)
      : 0;

  return (
    <div className="ui-container relative isolate overflow-hidden rounded-[30px] p-3.5 sm:p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -right-16 -z-10 size-44 rounded-full bg-mint/20 blur-[70px] dark:bg-[#b9e5ce]/10"
      />

      <button
        type="button"
        onClick={action.onClick}
        disabled={action.disabled}
        className={cn(
          "btn-iris w-full text-[12px]",
          action.countdown && "is-countdown tabular",
        )}
      >
        {action.icon}
        {action.label}
      </button>

      <div className="mt-4 rounded-2xl border border-ink/[0.08] bg-cream-2/40 p-3">
        <div className="flex items-center justify-between font-mono text-[9.5px]">
          <span className="text-ink-mute">Your mints</span>
          <span className="tabular text-ink">
            {showWalletProgress
              ? `${formatCount(walletMinted)} / ${formatCount(walletLimit)}`
              : "—"}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Your mint progress"
          aria-valuemin={0}
          aria-valuemax={showWalletProgress ? Number(walletLimit) : 0}
          aria-valuenow={showWalletProgress ? Number(walletMinted) : 0}
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/[0.07]"
        >
          {walletProgress > 0 ? (
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#8b77f2,#6c55e0_55%,#b96ab8)] transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(walletProgress, 1)}%` }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
