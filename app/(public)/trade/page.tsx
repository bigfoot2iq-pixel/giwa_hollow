"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAccount, useBalance } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatEther, parseEther } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Coins,
  Copy,
  Droplets,
  Loader2,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  giwaSepolia,
  IS_SWAP_POOL_CONFIGURED,
  SWAP_POOL_ADDRESS,
} from "@/lib/contracts";
import {
  useApproveTokens,
  useBuyAriwa,
  usePriceHistory,
  useSellAriwa,
  useSwapPoolPaused,
  useSwapPoolState,
  useTokenAllowance,
  useTokenBalance,
} from "@/lib/hooks";
import { ART_TONES, NFT_PIECES } from "@/lib/art";
import { cn } from "@/lib/utils/cn";
import { formatCompactNumber } from "@/lib/utils/format";
import {
  BPS_DENOMINATOR,
  DEFAULT_FEE_BPS,
  getAmountOut,
  priceImpactBps,
} from "@/lib/utils/amm";
import { TradeChart } from "@/components/trade/TradeChart";
import { TokenChip } from "@/components/trade/token-marks";

const EXPLORER_URL =
  giwaSepolia.blockExplorers?.default.url ?? "https://sepolia-explorer.giwa.io";

const SLIPPAGE_BPS = 100n; // 1%

/** Percent shortcuts shown under the amount, like a DEX swap form. */
const PRESET_PERCENTS = [5, 50] as const;
type Preset = (typeof PRESET_PERCENTS)[number] | "max";

/** Presets are rounded down to this many decimals so they never exceed the balance. */
const PRESET_DECIMALS = 6;

/** Keep a little ETH back on "Max" so the wallet can still pay gas. */
const ETH_GAS_BUFFER = parseEther("0.0005");

type Mode = "buy" | "sell";

function parseAmountInput(value: string): bigint | null {
  if (!value || value === ".") return null;
  try {
    return parseEther(value);
  } catch {
    return null;
  }
}

/** Format wei for display, keeping small amounts precise and shortening large ones. */
function formatAmount(value: bigint | undefined, fractionDigits = 6): string {
  if (value === undefined) return "—";
  return formatCompactNumber(formatEther(value), {
    maximumFractionDigits: fractionDigits,
    fallback: "—",
  });
}

/**
 * Display a quote with a precision that matches its size: ARIWA normally
 * shows 2 decimals, but a dust-sized quote stays visible instead of reading 0.
 */
function formatQuoteAmount(
  value: bigint | undefined,
  symbol: "ETH" | "ARIWA",
): string {
  if (value === undefined) return "—";
  const standard = symbol === "ARIWA" ? 2 : 6;
  const dustThreshold = 10n ** BigInt(18 - standard);
  return formatAmount(value, value > 0n && value < dustThreshold ? 8 : standard);
}

/** Round wei down to a number of decimals. Never rounds up past a balance. */
function floorTo(value: bigint, decimals = PRESET_DECIMALS): bigint {
  const factor = 10n ** BigInt(18 - decimals);
  return (value / factor) * factor;
}

/** Group the whole part while keeping the raw fraction: 1234.5 -> 1,234.5 */
function groupWhole(value: string): string {
  if (!value) return value;
  const [whole, fraction] = value.split(".");
  const groupedWhole = new Intl.NumberFormat("en-US").format(
    whole === "" ? 0n : BigInt(whole),
  );
  return fraction !== undefined ? `${groupedWhole}.${fraction}` : groupedWhole;
}

/**
 * Accept what people actually type or paste: "1,234.5", "1.234,5", " 0.5 ".
 * Returns null when the value is not a valid 18-decimal amount.
 */
function normalizeAmountInput(value: string): string | null {
  let next = value.replace(/\s+/g, "");
  if (next.includes(",") && next.includes(".")) {
    // Both present: treat the last one as the decimal separator.
    const decimal = Math.max(next.lastIndexOf(","), next.lastIndexOf("."));
    next =
      next.slice(0, decimal).replace(/[.,]/g, "") +
      "." +
      next.slice(decimal + 1).replace(/[.,]/g, "");
  } else if (next.includes(",")) {
    // A lone comma is a thousands separator when it groups three digits
    // ("10,000"), otherwise a decimal comma ("1,5").
    next = /^\d{1,3}(,\d{3})+$/.test(next)
      ? next.replace(/,/g, "")
      : next.replace(/,/g, ".");
  }
  return /^\d*\.?\d{0,18}$/.test(next) ? next : null;
}

/** Strip noise from an amount when the field loses focus: 001.500 -> 1.5 */
function tidyAmountInput(value: string): string {
  if (!value || value === ".") return "";
  const [whole, fraction] = value.split(".");
  const safeWhole = (whole === "" ? "0" : whole).replace(/^0+(?=\d)/, "");
  if (fraction === undefined) return safeWhole;
  const safeFraction = fraction.replace(/0+$/, "");
  return safeFraction ? `${safeWhole}.${safeFraction}` : safeWhole;
}

/** Shrink the big number once it gets long so it never spills out of the card. */
function amountFontClass(length: number): string {
  if (length > 20) return "text-[1.4rem]";
  if (length > 14) return "text-[1.7rem]";
  return "text-[2rem]";
}

function isUserRejection(error: Error): boolean {
  const msg =
    (error as Error & { shortMessage?: string }).shortMessage ?? error.message ?? "";
  return /user rejected|user denied|rejected the request/i.test(msg);
}

function readableError(error: Error): string {
  const msg =
    (error as Error & { shortMessage?: string }).shortMessage ?? error.message ?? "";
  if (/slippage exceeded/i.test(msg)) {
    return "The pool price moved before the trade landed. Try again.";
  }
  if (/pool not seeded/i.test(msg)) {
    return "The pool has no liquidity yet.";
  }
  if (/amount too small/i.test(msg)) {
    return "That amount is too small to swap.";
  }
  if (/insufficient token liquidity/i.test(msg)) {
    return "The pool is low on ARIWA right now. Try a smaller amount.";
  }
  if (/insufficient eth liquidity/i.test(msg)) {
    return "The pool is low on ETH right now. Try a smaller amount.";
  }
  if (/paused/i.test(msg)) return "Trading is paused by the pool owner.";
  if (/insufficient funds/i.test(msg)) return "Not enough ETH to cover the amount and gas.";
  return msg || "Something went wrong.";
}

function ReserveRow({
  label,
  value,
  symbol,
}: {
  label: string;
  value: string;
  symbol: "ETH" | "ARIWA";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-ink/[0.08] bg-paper/55 px-4 py-3">
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute">
        {label}
      </span>
      <span className="font-header text-sm font-extrabold tracking-[-0.02em] text-ink">
        {value}{" "}
        <span className="font-mono text-[8px] font-normal uppercase tracking-[0.12em] text-ink-mute">
          {symbol}
        </span>
      </span>
    </div>
  );
}

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the pool address.");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <a
        href={`${EXPLORER_URL}/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-w-0 items-center gap-1.5 font-mono text-[11px] font-medium text-ink transition hover:text-iris"
        title="Open in the GIWA explorer"
      >
        <span className="truncate">
          {address.slice(0, 8)}…{address.slice(-6)}
        </span>
        <ArrowUpRight className="size-3 shrink-0 text-ink-mute" />
      </a>
      <button
        type="button"
        onClick={copy}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-paper/70 text-ink-mute transition hover:border-iris/30 hover:text-iris"
        aria-label="Copy pool address"
      >
        {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
      </button>
    </div>
  );
}

export default function TradePage() {
  if (!IS_SWAP_POOL_CONFIGURED) {
    return <PoolNotConfigured />;
  }
  return <TradeDesk />;
}

function PoolNotConfigured() {
  return (
    <div className="page-shell">
      <p className="eyebrow">The market</p>
      <h1 className="display mt-4 text-[clamp(2.2rem,5vw,3.6rem)] text-ink">
        Trading opens soon
      </h1>
      <p className="mt-3 max-w-xl text-[13px] leading-6 text-ink-soft">
        The ARIWA/ETH market-maker has not been deployed to this build yet. Once
        its address is in the environment, live pricing and trading light up
        here.
      </p>

      <div className="ui-container mt-8 max-w-2xl rounded-[28px] p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-butter/50 text-butter-ink">
            <Coins className="size-5" />
          </span>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-mute">
              One deploy
            </p>
            <h2 className="mt-1 font-header text-xl font-extrabold tracking-[-0.03em] text-ink">
              Deploy the pool
            </h2>
          </div>
        </div>

        <pre className="mt-5 overflow-x-auto whitespace-pre-wrap break-all rounded-2xl border border-ink/10 bg-[#1d1826] px-5 py-4 font-mono text-[11px] leading-6 text-[#f7e3a0]">
          npx hardhat run scripts/deploy-swap-pool.ts --network giwaSepolia
        </pre>

        <p className="mt-4 text-[11.5px] leading-6 text-ink-soft">
          Then set <code className="rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[10.5px]">NEXT_PUBLIC_SWAP_POOL_ADDRESS</code>{" "}
          to the printed address and restart the app. The script seeds the pool
          with ETH + ARIWA and verifies the contract.
        </p>
      </div>
    </div>
  );
}

function TradeDesk() {
  const { address } = useAccount();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>("buy");
  const [amount, setAmount] = useState("");
  const [preset, setPreset] = useState<Preset | null>(null);
  const [amountFocused, setAmountFocused] = useState(false);

  const {
    ethBalance: poolEth,
    tokenBalance: poolTokens,
    tokensPerEth,
    feeBps,
    isLoading: isPoolLoading,
    isError: isPoolError,
  } = useSwapPoolState();
  const { data: paused } = useSwapPoolPaused();
  const { data: priceHistory, isLoading: isPriceHistoryLoading } =
    usePriceHistory();
  const { data: walletTokens } = useTokenBalance(address);
  const { data: walletEth } = useBalance({
    address,
    query: { enabled: !!address },
  });
  const { data: allowance } = useTokenAllowance(
    address,
    SWAP_POOL_ADDRESS as `0x${string}`,
  );

  const {
    buy,
    isPending: isBuyPending,
    isConfirming: isBuyConfirming,
    isSuccess: isBuySuccess,
    error: buyError,
    reset: resetBuy,
  } = useBuyAriwa();
  const {
    sell,
    isPending: isSellPending,
    isConfirming: isSellConfirming,
    isSuccess: isSellSuccess,
    error: sellError,
    reset: resetSell,
  } = useSellAriwa();
  const {
    approve,
    isPending: isApprovePending,
    isConfirming: isApproveConfirming,
    isSuccess: isApproveSuccess,
    error: approveError,
    reset: resetApprove,
  } = useApproveTokens();

  const tokenAllowance = allowance as bigint | undefined;
  const tokenBalance = walletTokens as bigint | undefined;

  const parsed = parseAmountInput(amount);
  const amountValue = parsed !== null && parsed > 0n ? parsed : null;

  const poolFeeBps = feeBps ?? DEFAULT_FEE_BPS;

  /**
   * Constant-product quote against the live reserves — identical to
   * AriwaSwapPool.quoteBuy / quoteSell, computed locally so the form reacts
   * on every keystroke.
   */
  const quoteOut =
    amountValue !== null &&
    poolEth !== undefined &&
    poolTokens !== undefined &&
    poolEth > 0n &&
    poolTokens > 0n
      ? mode === "buy"
        ? getAmountOut(amountValue, poolEth, poolTokens, poolFeeBps)
        : getAmountOut(amountValue, poolTokens, poolEth, poolFeeBps)
      : undefined;

  const minOut =
    quoteOut !== undefined
      ? (quoteOut * (BPS_DENOMINATOR - SLIPPAGE_BPS)) / BPS_DENOMINATOR
      : undefined;

  /** How far this order moves the mid price, including the swap fee. */
  const impactBps =
    quoteOut !== undefined &&
    amountValue !== null &&
    poolEth !== undefined &&
    poolTokens !== undefined
      ? mode === "buy"
        ? priceImpactBps(amountValue, quoteOut, poolEth, poolTokens)
        : priceImpactBps(amountValue, quoteOut, poolTokens, poolEth)
      : undefined;
  const impactPercent =
    impactBps !== undefined ? Number(impactBps) / 100 : undefined;

  const outputSymbol: "ETH" | "ARIWA" = mode === "buy" ? "ARIWA" : "ETH";
  const quoteDisplay =
    quoteOut !== undefined ? formatQuoteAmount(quoteOut, outputSymbol) : "0.0";
  const minOutDisplay =
    minOut !== undefined ? formatQuoteAmount(minOut, outputSymbol) : undefined;
  const amountDisplay = amountFocused ? amount : groupWhole(amount);

  const walletBalance = mode === "buy" ? walletEth?.value : tokenBalance;
  const balanceSymbol = mode === "buy" ? "ETH" : "ARIWA";
  const insufficientBalance =
    amountValue !== null &&
    walletBalance !== undefined &&
    amountValue > walletBalance;

  /** ETH left for spending after keeping a gas reserve. */
  const spendableEth =
    walletBalance !== undefined && walletBalance > ETH_GAS_BUFFER
      ? walletBalance - ETH_GAS_BUFFER
      : 0n;

  const canUsePresets =
    !!address &&
    walletBalance !== undefined &&
    walletBalance > 0n &&
    (mode === "sell" || spendableEth > 0n);

  /** The wei value a 5/50/Max chip would fill in. */
  const presetAmount = useCallback(
    (next: Preset): bigint => {
      if (walletBalance === undefined || walletBalance === 0n) return 0n;
      const share = next === "max" ? 100n : BigInt(next);
      let value = (walletBalance * share) / 100n;
      if (mode === "buy" && value > spendableEth) value = spendableEth;
      return floorTo(value);
    },
    [walletBalance, mode, spendableEth],
  );

  const applyPreset = useCallback(
    (next: Preset) => {
      if (!canUsePresets) return;
      const value = presetAmount(next);
      setAmount(value > 0n ? formatEther(value) : "");
      setPreset(value > 0n ? next : null);
    },
    [canUsePresets, presetAmount],
  );

  /**
   * Start the form on 5% once the wallet balance is readable, so the field is
   * never an empty box. This runs once per connected account; after a trade or
   * a manual edit the field is left alone.
   */
  const defaultPresetFor = useRef<string | null>(null);
  useEffect(() => {
    if (!address || !canUsePresets) return;
    const previousFor = defaultPresetFor.current;
    if (previousFor === address) return;
    defaultPresetFor.current = address;
    // First visit: respect anything typed while the balance was loading.
    // A different account: replace the stale amount with its own 5% default.
    if (previousFor !== null || amount === "") applyPreset(5);
  }, [address, canUsePresets, amount, applyPreset]);

  const poolReady =
    poolEth !== undefined && poolTokens !== undefined && poolEth > 0n && poolTokens > 0n;
  const pausedBlocked = paused === true;
  const allowanceLoading =
    mode === "sell" && !!address && amountValue !== null && tokenAllowance === undefined;
  const needsApproval =
    mode === "sell" &&
    amountValue !== null &&
    tokenAllowance !== undefined &&
    tokenAllowance < amountValue;

  const isBuying = isBuyPending || isBuyConfirming;
  const isSelling = isSellPending || isSellConfirming;
  const isApproving = isApprovePending || isApproveConfirming;
  const isProcessing = isBuying || isSelling || isApproving;

  const canTrade =
    poolReady &&
    !pausedBlocked &&
    !isProcessing &&
    amountValue !== null &&
    quoteOut !== undefined &&
    quoteOut > 0n &&
    !insufficientBalance &&
    !allowanceLoading;

  useEffect(() => {
    if (!isBuySuccess) return;
    toast.success("ARIWA bought", {
      description: "The tokens are already in your wallet.",
    });
    queryClient.invalidateQueries();
    // Reset the form once the tx lands. This intentionally runs on success.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAmount("");
    setPreset(null);
    resetBuy();
  }, [isBuySuccess, queryClient, resetBuy]);

  useEffect(() => {
    if (!isSellSuccess) return;
    toast.success("ARIWA sold", {
      description: "The ETH is back in your wallet.",
    });
    queryClient.invalidateQueries();
    // Reset the form once the tx lands. This intentionally runs on success.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAmount("");
    setPreset(null);
    resetSell();
  }, [isSellSuccess, queryClient, resetSell]);

  useEffect(() => {
    if (!isApproveSuccess) return;
    toast.success("Approval confirmed", {
      description: "You can sell your ARIWA now.",
    });
    queryClient.invalidateQueries();
    resetApprove();
  }, [isApproveSuccess, queryClient, resetApprove]);

  useEffect(() => {
    if (!buyError) return;
    if (!isUserRejection(buyError)) toast.error(readableError(buyError));
    resetBuy();
  }, [buyError, resetBuy]);

  useEffect(() => {
    if (!sellError) return;
    if (!isUserRejection(sellError)) toast.error(readableError(sellError));
    resetSell();
  }, [sellError, resetSell]);

  useEffect(() => {
    if (!approveError) return;
    if (!isUserRejection(approveError)) toast.error(readableError(approveError));
    resetApprove();
  }, [approveError, resetApprove]);

  const switchMode = (next: Mode) => {
    if (isProcessing || next === mode) return;
    // Carry the quote across the flip so the trade keeps its size, like a DEX.
    const carry = quoteOut !== undefined ? floorTo(quoteOut) : 0n;
    setMode(next);
    setPreset(null);
    setAmount(carry > 0n ? formatEther(carry) : "");
  };

  const handleAmountChange = (value: string) => {
    const next = normalizeAmountInput(value);
    if (next === null) return;
    setAmount(next);
    // Any manual edit takes over from the percent shortcut.
    setPreset(null);
  };

  const handleAmountBlur = () => {
    setAmountFocused(false);
    setAmount((current) => tidyAmountInput(current));
  };

  const handleTrade = () => {
    if (!canTrade || amountValue === null || minOut === undefined) return;

    if (mode === "buy") {
      buy(amountValue, minOut);
      return;
    }

    if (needsApproval) {
      approve(SWAP_POOL_ADDRESS as `0x${string}`, amountValue);
      return;
    }

    sell(amountValue, minOut);
  };

  const art = NFT_PIECES.find((piece) => piece.id === 777) ?? NFT_PIECES[0];
  const tone = ART_TONES[art.tone];

  return (
    <div className="page-shell">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">The market</p>
          <h1 className="display mt-4 text-[clamp(2.2rem,5vw,3.6rem)] text-ink">
            Trade ARIWA
          </h1>
          <p className="mt-3 max-w-xl text-[13px] leading-6 text-ink-soft">
            Buy ARIWA with ETH or sell it back. Every order prices against a
            constant-product pool on GIWA Sepolia, so the rate moves with supply
            and demand — no order book, no waiting.
          </p>
        </div>
        <span className="hidden items-center gap-2 rounded-full border border-ink/10 bg-paper/60 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft sm:inline-flex">
          <span className="live-dot" />
          automatic pricing · live
        </span>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.58fr)_minmax(340px,1fr)] lg:items-stretch">
        <section className="order-1 ui-container relative overflow-hidden rounded-[28px] p-5 sm:p-7 lg:order-2 lg:col-start-2 lg:row-start-1 lg:h-full lg:p-6 xl:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-iris/10 blur-3xl"
          />
          <div className="relative flex h-full flex-col">
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-ink/[0.045] p-1">
              <button
                type="button"
                onClick={() => switchMode("buy")}
                disabled={isProcessing}
                className={cn(
                  "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold transition",
                  mode === "buy"
                    ? "bg-paper text-ink shadow-[0_2px_10px_-5px_rgba(39,33,50,0.45)]"
                    : "text-ink-mute hover:text-ink",
                )}
              >
                <Coins className="size-3.5" />
                Buy ARIWA
              </button>
              <button
                type="button"
                onClick={() => switchMode("sell")}
                disabled={isProcessing}
                className={cn(
                  "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold transition",
                  mode === "sell"
                    ? "bg-paper text-ink shadow-[0_2px_10px_-5px_rgba(39,33,50,0.45)]"
                    : "text-ink-mute hover:text-ink",
                )}
              >
                <ArrowDownUp className="size-3.5" />
                Sell ARIWA
              </button>
            </div>

            <div
              className={cn(
                "mt-4 rounded-2xl bg-ink/[0.035] p-4 transition-colors",
                "focus-within:bg-iris/[0.06]",
                insufficientBalance && "ring-1 ring-danger/35",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-medium text-ink-mute">
                  {mode === "buy" ? "You pay" : "You sell"}
                </span>
                <span className="text-[11px] text-ink-mute">
                  Balance{" "}
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      insufficientBalance ? "text-danger" : "text-ink-soft",
                    )}
                  >
                    {formatAmount(walletBalance, 6)} {balanceSymbol}
                  </span>
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3">
                <input
                  value={amountDisplay}
                  onChange={(event) => handleAmountChange(event.target.value)}
                  onFocus={(event) => {
                    setAmountFocused(true);
                    const input = event.currentTarget;
                    // Select everything on focus, so a new amount replaces the old one.
                    requestAnimationFrame(() => input.select());
                  }}
                  onBlur={handleAmountBlur}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && canTrade) {
                      event.preventDefault();
                      handleTrade();
                    }
                  }}
                  disabled={isProcessing}
                  inputMode="decimal"
                  enterKeyHint="done"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="0.0"
                  aria-label={mode === "buy" ? "ETH amount to spend" : "ARIWA amount to sell"}
                  className={cn(
                    "min-w-0 flex-1 bg-transparent font-header font-semibold tabular-nums tracking-[-0.04em] text-ink outline-none placeholder:text-ink-faint disabled:opacity-60",
                    amountFontClass(amountDisplay.length),
                  )}
                />
                <TokenChip symbol={mode === "buy" ? "ETH" : "ARIWA"} />
              </div>

              {canUsePresets && (
                <div
                  className="mt-3 grid grid-cols-3 gap-1.5"
                  role="group"
                  aria-label="Fill a percentage of your balance"
                >
                  {([...PRESET_PERCENTS, "max"] as const).map((option) => {
                    const active = preset === option;
                    const label = option === "max" ? "Max" : `${option}%`;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => applyPreset(option)}
                        disabled={isProcessing}
                        aria-pressed={active}
                        title={
                          option === "max"
                            ? mode === "buy"
                              ? `Use your full ETH balance, keeping ${formatEther(ETH_GAS_BUFFER)} ETH for gas`
                              : "Use your full ARIWA balance"
                            : `Fill ${option}% of your ${balanceSymbol} balance`
                        }
                        className={cn(
                          "h-8 rounded-xl text-[11px] font-medium transition",
                          active
                            ? "bg-iris/[0.14] text-iris ring-1 ring-iris/30"
                            : "bg-paper/60 text-ink-mute hover:bg-paper hover:text-ink",
                          "disabled:cursor-not-allowed disabled:opacity-40",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {canUsePresets && mode === "buy" && preset === "max" && (
                <p className="mt-2 text-right text-[10px] text-ink-faint">
                  Keeping {formatEther(ETH_GAS_BUFFER)} ETH back for gas
                </p>
              )}
            </div>

            <div className="relative z-10 -my-2.5 flex justify-center">
              <button
                type="button"
                onClick={() => switchMode(mode === "buy" ? "sell" : "buy")}
                disabled={isProcessing}
                aria-label={
                  mode === "buy" ? "Switch to selling ARIWA" : "Switch to buying ARIWA"
                }
                title="Switch direction"
                className="flex size-9 items-center justify-center rounded-xl border border-ink/[0.08] bg-paper text-ink-soft shadow-[0_4px_12px_-6px_rgba(39,33,50,0.45)] transition hover:border-iris/30 hover:text-iris disabled:opacity-40"
              >
                <ArrowDown className="size-4" />
              </button>
            </div>

            <div
              className={cn(
                "rounded-2xl p-4 transition-colors",
                quoteOut !== undefined ? "bg-iris/[0.055]" : "bg-ink/[0.03]",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-medium text-ink-mute">
                  You receive
                </span>
                <span className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                  {quoteOut !== undefined ? "Estimated" : "—"}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3">
                <span
                  aria-live="polite"
                  className={cn(
                    "min-w-0 flex-1 truncate font-header font-semibold tabular-nums tracking-[-0.04em]",
                    amountFontClass(quoteDisplay.length),
                    quoteOut !== undefined ? "text-ink" : "text-ink-faint",
                  )}
                >
                  {quoteDisplay}
                </span>
                <TokenChip symbol={outputSymbol} />
              </div>
            </div>

            <details className="group mt-3 rounded-2xl border border-ink/[0.07] bg-paper/45">
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-[11px] text-ink-mute transition hover:text-ink">
                <span className="tabular-nums">
                  {tokensPerEth !== undefined
                    ? `1 ETH = ${formatAmount(tokensPerEth, 2)} ARIWA`
                    : "Pool rate"}
                </span>
                <span className="inline-flex items-center gap-1">
                  Details
                  <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
                </span>
              </summary>
              <dl className="space-y-2 border-t border-ink/[0.06] px-3.5 py-3 text-[11px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-mute">Price impact</dt>
                  <dd
                    className={cn(
                      "font-medium tabular-nums",
                      impactPercent !== undefined && impactPercent >= 5
                        ? "text-warning-ink"
                        : "text-ink-soft",
                    )}
                  >
                    {impactPercent !== undefined
                      ? `${impactPercent.toFixed(2)}%`
                      : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-mute">Min received</dt>
                  <dd className="font-medium tabular-nums text-ink-soft">
                    {minOutDisplay
                      ? `${minOutDisplay} ${outputSymbol}`
                      : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-mute">Slippage</dt>
                  <dd className="font-medium tabular-nums text-ink-soft">
                    {Number(SLIPPAGE_BPS) / 100}%
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-mute">Pool fee</dt>
                  <dd className="font-medium tabular-nums text-ink-soft">
                    {feeBps !== undefined
                      ? `${(Number(feeBps) / 100).toFixed(2)}%`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </details>

            <div className="mt-4">
              <ConnectButton.Custom>
                {({ openConnectModal, openChainModal, chain, mounted }) => {
                  if (!mounted) {
                    return (
                      <button disabled className="btn-iris h-14 w-full text-sm">
                        <Loader2 className="size-4.5 animate-spin" />
                        Loading wallet…
                      </button>
                    );
                  }

                  if (!chain) {
                    return (
                      <button
                        type="button"
                        onClick={openConnectModal}
                        className="btn-iris h-14 w-full text-sm"
                      >
                        <Wallet className="size-4.5" />
                        Connect wallet to trade
                      </button>
                    );
                  }

                  if (chain.unsupported) {
                    return (
                      <button
                        type="button"
                        onClick={openChainModal}
                        className="btn-iris h-14 w-full text-sm"
                      >
                        <Wallet className="size-4.5" />
                        Switch to {giwaSepolia.name}
                      </button>
                    );
                  }

                  let label = mode === "buy" ? "Buy ARIWA" : "Sell ARIWA";
                  if (isApprovePending) label = "Confirm approval in wallet…";
                  else if (isApproveConfirming) label = "Approving…";
                  else if (isBuyPending) label = "Confirm purchase in wallet…";
                  else if (isBuyConfirming) label = "Buying ARIWA…";
                  else if (isSellPending) label = "Confirm sale in wallet…";
                  else if (isSellConfirming) label = "Selling ARIWA…";
                  else if (isPoolError) label = "Pool unavailable";
                  else if (!poolReady)
                    label = isPoolLoading ? "Loading pool…" : "Pool has no liquidity";
                  else if (pausedBlocked) label = "Trading paused";
                  else if (amountValue === null) label = "Enter an amount";
                  else if (quoteOut === 0n) label = "Amount too small";
                  else if (allowanceLoading) label = "Checking allowance…";
                  else if (insufficientBalance)
                    label = `Insufficient ${balanceSymbol} balance`;
                  else if (mode === "sell" && needsApproval) label = "Approve ARIWA";

                  return (
                    <button
                      type="button"
                      onClick={handleTrade}
                      disabled={!canTrade}
                      className="btn-iris h-14 w-full text-sm"
                    >
                      {isProcessing ? (
                        <Loader2 className="size-4.5 animate-spin" />
                      ) : mode === "buy" ? (
                        <Coins className="size-4.5" />
                      ) : (
                        <ArrowDownUp className="size-4.5" />
                      )}
                      {label}
                    </button>
                  );
                }}
              </ConnectButton.Custom>
            </div>

            <p className="mt-auto flex items-center justify-center gap-1.5 pt-3 text-[10.5px] text-ink-mute">
              <ShieldCheck className="size-3.5 text-iris" />
              AMM pricing, enforced on-chain. Testnet funds only.
            </p>
          </div>
        </section>

        <TradeChart
          className="order-2 lg:order-1 lg:col-start-1 lg:row-start-1"
          points={priceHistory}
          liveTokensPerEth={tokensPerEth}
          feeBps={feeBps}
          isLoading={isPriceHistoryLoading}
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="ui-container rounded-[26px] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-mute">
                The pool wallet
              </p>
              <h2 className="mt-1 font-header text-lg font-extrabold tracking-[-0.03em] text-ink">
                Open liquidity
              </h2>
            </div>
            <span className="pill">
              <span className="live-dot" />
              live
            </span>
          </div>

          <div className="mt-5 space-y-2.5">
            <ReserveRow
              label="ETH reserve"
              value={formatAmount(poolEth, 4)}
              symbol="ETH"
            />
            <ReserveRow
              label="ARIWA reserve"
              value={formatAmount(poolTokens, 2)}
              symbol="ARIWA"
            />
          </div>

          <div className="mt-5 border-t border-ink/[0.08] pt-4">
            <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-ink-mute">
              Contract
            </p>
            <div className="mt-1.5">
              <CopyAddress address={SWAP_POOL_ADDRESS as string} />
            </div>
          </div>
        </div>

        <div className="ui-container rounded-[26px] p-6">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-mint/40 text-mint-ink">
              <ShieldCheck className="size-4" />
            </span>
            <h2 className="font-header text-lg font-extrabold tracking-[-0.03em] text-ink">
              How the desk works
            </h2>
          </div>
          <ul className="mt-4 space-y-3">
            <li className="flex items-start gap-2.5 text-[11.5px] leading-5 text-ink-soft">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-iris" />
              The pool holds both ETH and ARIWA, so every swap settles instantly
              against real reserves.
            </li>
            <li className="flex items-start gap-2.5 text-[11.5px] leading-5 text-ink-soft">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-iris" />
              There is no owner-set rate: x × y = k prices each trade, so buys
              push the price up and sells pull it down.
            </li>
            <li className="flex items-start gap-2.5 text-[11.5px] leading-5 text-ink-soft">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-iris" />
              A {feeBps !== undefined ? (Number(feeBps) / 100).toFixed(2) : "0.30"}%
              fee stays in the pool, and a 1% slippage guard protects each order.
            </li>
          </ul>
          <Link
            href="/faucet"
            className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft transition hover:text-iris"
          >
            <Droplets className="size-3.5" />
            Need testnet ETH?
            <ArrowRight className="size-3" />
          </Link>
        </div>

        <div
          className={`relative overflow-hidden rounded-[26px] border p-5 ${tone.border} ${tone.panel}`}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-ink-soft">
                Resident note
              </p>
              <p className="mt-2 max-w-[190px] font-header text-lg font-extrabold leading-tight tracking-[-0.03em] text-ink">
                The pool never sleeps.
              </p>
              <p className="mt-2 max-w-[185px] text-[10.5px] leading-5 text-ink-soft">
                Buy low, sell high, or just top up before the next raffle.
              </p>
            </div>
            <span className="relative size-20 shrink-0 overflow-hidden rounded-full border-4 border-white/60 shadow-lg dark:border-white/15">
              <Image src={art.src} alt="" fill sizes="80px" className="object-cover" />
            </span>
          </div>
        </div>
      </div>

      <p className="mt-5 flex items-start gap-2 text-[11px] leading-5 text-ink-mute">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-iris" />
        <span>
          {giwaSepolia.name} only. The pool is a smart contract, not a custodial
          wallet — reserves and every trade are visible on the{" "}
          <a
            href={`${EXPLORER_URL}/address/${SWAP_POOL_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-iris hover:underline"
          >
            GIWA explorer
          </a>
          .
        </span>
      </p>
    </div>
  );
}
