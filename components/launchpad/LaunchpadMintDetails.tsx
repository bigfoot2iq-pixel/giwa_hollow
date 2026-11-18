"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Coins,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { giwaSepolia } from "@/lib/contracts";
import { cn } from "@/lib/utils/cn";
import { ChainIcon } from "./ChainIcon";
import { DropStatusPill } from "./DropStatusPill";
import {
  formatAmount,
  formatCount,
  formatCurrency,
  shortAddress,
  type DropStatus,
  type EligibilityResponse,
  type MintValues,
  type PaymentCurrency,
} from "./launchpad-format";

/**
 * Everything that describes the drop: the phase, price, quantity, holder gate,
 * confirmation, and the contract link. The mint action lives in its own card so
 * this surface can stay informative without becoming a single tall stack.
 */
export function LaunchpadMintDetails({
  status,
  values,
  address,
  configured,
  price,
  currency,
  paymentBalance,
  paymentBalanceError,
  totalCost,
  walletLimit,
  maxQuantity,
  quantity,
  busy,
  confirming,
  onQuantity,
  totalLabel,
  eligibility,
  eligibilityError,
  onRetryEligibility,
  statusDetail,
  contractAddress,
  ipBlocked = false,
}: {
  status: DropStatus;
  values?: MintValues;
  address?: `0x${string}`;
  configured: boolean;
  price: bigint;
  currency: PaymentCurrency;
  paymentBalance?: bigint;
  paymentBalanceError?: boolean;
  totalCost: bigint;
  walletLimit: bigint;
  maxQuantity: number;
  quantity: number;
  busy: boolean;
  confirming: boolean;
  onQuantity: (delta: number) => void;
  totalLabel: string;
  eligibility: EligibilityResponse | null;
  eligibilityError: string | null;
  onRetryEligibility: () => void;
  statusDetail: string;
  contractAddress?: `0x${string}`;
  ipBlocked?: boolean;
}) {
  return (
    <div className="ui-container relative isolate overflow-hidden rounded-[30px] p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 -z-10 size-52 rounded-full bg-lilac/25 blur-[80px] dark:bg-[#d8c9fa]/10"
      />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-ink-mute">
            Mint phase
          </p>
          <h2 className="mt-1 font-header text-xl font-extrabold tracking-[-0.03em] text-ink">
            Mint
          </h2>
        </div>
        <DropStatusPill status={status} />
      </div>

      <div className="mt-4 grid grid-cols-[0.82fr_1.18fr] gap-2">
        <div className="flex flex-col justify-between rounded-2xl border border-ink/[0.08] bg-cream-2/45 px-3 py-2.5">
          <div className="flex items-center justify-between gap-1">
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-mute">
              Price
            </p>
            <p className="font-mono text-[7px] uppercase tracking-[0.1em] text-ink-faint">
              per NFT
            </p>
          </div>
          <p className="mt-1.5 font-header text-[20px] font-extrabold leading-none tracking-[-0.03em] text-ink">
            {values ? formatCurrency(price, currency) : "—"}
          </p>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-ink/[0.08] bg-paper/55 px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-mute">
              Quantity
            </p>
            <p className="truncate font-mono text-[8.5px] text-ink-mute">
              {address
                ? `${formatCount(Math.max(maxQuantity, 0))} left for you`
                : values
                  ? `1 per user`
                  : "—"}
            </p>
          </div>

          <div className="mt-1.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onQuantity(-1)}
              disabled={quantity <= 1 || busy || confirming}
              aria-label="Decrease quantity"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-ink/10 bg-paper text-ink-soft transition hover:border-iris/30 hover:text-iris disabled:opacity-30"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="tabular font-header text-xl font-extrabold leading-none text-ink">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => onQuantity(1)}
              disabled={quantity >= maxQuantity || busy || confirming}
              aria-label="Increase quantity"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-ink/10 bg-paper text-ink-soft transition hover:border-iris/30 hover:text-iris disabled:opacity-30"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-dashed border-ink/[0.1] pt-3">
        <span className="text-[11px] text-ink-mute">Total</span>
        <span className="tabular font-header text-lg font-extrabold tracking-[-0.02em] text-ink">
          {totalLabel}
        </span>
      </div>

      <PaymentBalance
        address={address}
        currency={currency}
        balance={paymentBalance}
        error={paymentBalanceError}
        totalCost={totalCost}
        busy={busy || confirming}
      />

      <HolderGate
        address={address}
        eligibility={eligibility}
        error={eligibilityError}
        onRetry={onRetryEligibility}
      />

      {ipBlocked ? (
        <div className="mt-3 rounded-2xl border border-success/30 bg-success/[0.06] p-3">
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ink">
            <Check className="size-3.5 text-success-ink" />
            You already minted
          </p>
          <p className="mt-1 text-[10px] leading-5 text-ink-mute">
            One NFT per user, and {formatCount(walletLimit)} per wallet.
            Switching wallets won&apos;t unlock another mint.
          </p>
        </div>
      ) : null}

      {!configured ? (
        <div className="mt-4 rounded-2xl border border-dashed border-iris/25 bg-iris/[0.04] p-4 text-center">
          <Sparkles className="mx-auto size-4 text-iris" />
          <p className="mt-2 text-[11px] font-semibold text-ink">
            The collection is being wired up.
          </p>
          <p className="mt-1 text-[10px] leading-5 text-ink-mute">
            Check back soon, or launch your own collection in the meantime.
          </p>
        </div>
      ) : status.tone === "error" ? (
        <div className="mt-4 rounded-2xl border border-danger/20 bg-danger/[0.05] p-4 text-center">
          <AlertTriangle className="mx-auto size-4 text-danger" />
          <p className="mt-2 text-[11px] font-semibold text-ink">
            The collection could not be read.
          </p>
          <p className="mt-1 text-[10px] leading-5 text-ink-mute">
            GIWA may be busy. Retry the contract read before minting.
          </p>
        </div>
      ) : null}

      <p className="mt-3.5 text-center text-[10px] leading-5 text-ink-mute">
        {statusDetail}
      </p>

      {contractAddress ? (
        <a
          href={`${giwaSepolia.blockExplorers.default.url}/address/${contractAddress}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 border-t border-ink/[0.07] pt-3 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute transition hover:text-iris"
        >
          {shortAddress(contractAddress, 4)} on GIWA Explorer
          <ArrowUpRight className="size-3" />
        </a>
      ) : null}
    </div>
  );
}

function PaymentBalance({
  address,
  currency,
  balance,
  error,
  totalCost,
  busy,
}: {
  address?: `0x${string}`;
  currency: PaymentCurrency;
  balance?: bigint;
  error?: boolean;
  totalCost: bigint;
  busy: boolean;
}) {
  if (!address || totalCost === 0n) return null;

  const symbol = currency.symbol;

  if (balance === undefined) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-ink/[0.08] bg-cream-2/40 px-3 py-2.5 text-[10px] text-ink-mute">
        {error ? (
          <>
            <AlertTriangle className="size-3.5 text-warning" />
            Couldn&apos;t read your {symbol} balance. The contract will verify it
            when you mint.
          </>
        ) : (
          <>
            <Loader2 className="size-3.5 animate-spin text-iris" />
            Checking your {symbol} balance…
          </>
        )}
      </div>
    );
  }

  if (balance >= totalCost) {
    return (
      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-ink/[0.08] bg-cream-2/40 px-3 py-2.5">
        <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-mute">
          Your {symbol}
        </span>
        <span className="tabular font-mono text-[10px] font-semibold text-ink">
          {formatCurrency(balance, currency)}
        </span>
      </div>
    );
  }

  const shortfall = totalCost - balance;

  return (
    <div className="mt-3 rounded-2xl border border-danger/25 bg-danger/[0.05] p-3">
      <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ink">
        <AlertTriangle className="size-3.5 text-danger" />
        Not enough {symbol} to mint
      </p>
      <p className="mt-1 text-[10px] leading-5 text-ink-mute">
        You have{" "}
        <span className="font-semibold text-ink-soft">
          {formatCurrency(balance, currency)}
        </span>{" "}
        but this mint needs{" "}
        <span className="font-semibold text-ink-soft">
          {formatCurrency(totalCost, currency)}
        </span>
        . You&apos;re{" "}
        <span className="font-semibold text-ink-soft">
          {formatCurrency(shortfall, currency)}
        </span>{" "}
        short.
      </p>

      {currency.isNative ? null : (
        <Link
          href="/trade"
          aria-disabled={busy}
          className={cn(
            "mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-iris/25 bg-iris/[0.07] px-3 py-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-iris-deep transition hover:border-iris/40 hover:bg-iris/[0.12]",
            busy && "pointer-events-none opacity-50",
          )}
        >
          <Coins className="size-3.5" />
          Buy {symbol} in the pool
          <ArrowUpRight className="size-3" />
        </Link>
      )}

      <p className="mt-2 text-center text-[9px] leading-4 text-ink-faint">
        {currency.isNative
          ? "Add ETH on GIWA Sepolia to cover the mint price plus gas."
          : "You still need a little ETH in your wallet for gas."}
      </p>
    </div>
  );
}

function HolderGate({
  address,
  eligibility,
  error,
  onRetry,
}: {
  address?: `0x${string}`;
  eligibility: EligibilityResponse | null;
  error: string | null;
  onRetry: () => void;
}) {
  if (!address) return null;

  // The holder gate is opt-in: when no chain/currency has a requirement the
  // server answers `gateEnabled: false`, and the panel should be absent
  // entirely rather than advertising an "open to all" state. Wait for that
  // answer before rendering anything so a disabled gate never flashes.
  if (!eligibility && !error) return null;

  if (error) {
    return (
      <div className="mt-3 rounded-xl border border-warning/25 bg-warning/[0.06] p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold text-warning-ink">
          <AlertTriangle className="size-3.5" />
          Holder check unavailable
        </p>
        <p className="mt-1 text-[9.5px] leading-4 text-ink-mute">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1 font-mono text-[8.5px] uppercase tracking-[0.14em] text-iris-deep transition hover:text-iris"
        >
          <RefreshCw className="size-3" />
          Retry check
        </button>
      </div>
    );
  }

  if (!eligibility || !eligibility.gateEnabled) return null;

  return (
    <div
      className={cn(
        "mt-3 rounded-2xl border p-3",
        eligibility.eligible
          ? "border-success/30 bg-success/[0.06]"
          : "border-ink/[0.08] bg-cream-2/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-mute">
          Holder access
        </p>
        <span
          className={cn(
            "inline-flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.14em]",
            eligibility.eligible ? "text-success-ink" : "text-danger",
          )}
        >
          {eligibility.eligible ? (
            <Check className="size-3" />
          ) : (
            <AlertTriangle className="size-3" />
          )}
          {eligibility.eligible ? "Eligible" : "Not eligible"}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {eligibility.requirements.map((requirement) => (
          <div
            key={requirement.chain}
            className="rounded-xl border border-ink/[0.07] bg-paper/55 px-2.5 py-2"
          >
            <div className="flex items-center gap-1.5">
              <ChainIcon chain={requirement.chain} />
              <p className="min-w-0 flex-1 truncate text-[10px] font-semibold text-ink">
                {requirement.label}
              </p>
              {requirement.error ? (
                <span
                  className="size-1.5 rounded-full bg-ink-faint"
                  title="Balance unavailable"
                />
              ) : (
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    requirement.meets ? "bg-success" : "bg-danger/70",
                  )}
                  title={requirement.meets ? "Requirement met" : "Not met"}
                />
              )}
            </div>
            <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.06em] text-ink-mute">
              min {formatAmount(requirement.minAmount, 4)} {requirement.symbol}
            </p>
            <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.06em] text-ink-mute">
              you{" "}
              <span className="text-ink-soft">
                {requirement.error
                  ? "unavailable"
                  : `${formatAmount(requirement.balance, 4)} ${requirement.symbol}`}
              </span>
            </p>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[9px] leading-4 text-ink-mute">
          {eligibility.eligible
            ? "Requirement met — minting is unlocked."
            : "Hold the minimum on one listed chain."}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1 font-mono text-[8px] uppercase tracking-[0.12em] text-iris-deep transition hover:text-iris"
        >
          <RefreshCw className="size-2.5" />
          Refresh
        </button>
      </div>
    </div>
  );
}
