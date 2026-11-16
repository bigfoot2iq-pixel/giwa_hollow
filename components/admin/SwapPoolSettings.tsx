"use client";

import { useEffect, useRef, useState } from "react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatEther, isAddress, parseEther } from "viem";
import { toast } from "sonner";
import {
  AriwaSwapPoolABI,
  AriwaTokenABI,
  giwaSepolia,
  SWAP_POOL_ADDRESS,
} from "@/lib/contracts";
import { formatCompactNumber } from "@/lib/utils/format";

const POOL_ADDRESS =
  SWAP_POOL_ADDRESS && isAddress(SWAP_POOL_ADDRESS) ? SWAP_POOL_ADDRESS : undefined;

/** Keeps the read hooks type-safe while their query is disabled. */
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/** Keep a little ETH back on "Max" so the deposit still has gas. */
const ETH_GAS_BUFFER = parseEther("0.0005");

const inputClass =
  "w-full rounded border border-ink/10 bg-paper px-4 py-3 text-sm text-text-primary placeholder:text-ink/30 focus:border-iris/50 focus:outline-none focus:ring-1 focus:ring-iris/30";

function shortError(error: Error): string {
  const withShort = error as Error & { shortMessage?: string };
  return (withShort.shortMessage || error.message).split("\n")[0];
}

/** Parse a decimal token/ETH amount into wei, rejecting partial or malformed input. */
function parseAmount(value: string): bigint | null {
  const trimmed = value.trim();
  if (!/^(?:\d+(?:\.\d{1,18})?|\.\d{1,18})$/.test(trimmed)) return null;
  try {
    return parseEther(trimmed);
  } catch {
    return null;
  }
}

/** Compact a wei amount for display without touching the editable inputs. */
function formatTokenAmount(value: bigint | undefined, maxFractionDigits = 4): string {
  if (value === undefined) return "…";
  return formatCompactNumber(formatEther(value), {
    maximumFractionDigits: maxFractionDigits,
  });
}

/**
 * Small wrapper around a single write + receipt pair. Success callbacks are
 * kept in a ref so callers can pass inline functions without re-subscribing.
 */
function useTxAction(
  successMessage: string,
  onSuccess?: () => void,
  onError?: () => void,
) {
  const successRef = useRef(onSuccess);
  const errorRef = useRef(onError);

  useEffect(() => {
    successRef.current = onSuccess;
    errorRef.current = onError;
  }, [onSuccess, onError]);

  const {
    writeContract,
    data: hash,
    isPending,
    error,
    reset,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (!isSuccess) return;
    toast.success(successMessage);
    successRef.current?.();
    reset();
  }, [isSuccess, successMessage, reset]);

  useEffect(() => {
    if (!error) return;
    const message = shortError(error);
    if (!/user rejected|user denied/i.test(message)) {
      toast.error(message || "Transaction failed");
    }
    errorRef.current?.();
    reset();
  }, [error, reset]);

  return { writeContract, isPending, isConfirming };
}

export function SwapPoolSettings() {
  const { address } = useAccount();

  const poolConfigured = !!POOL_ADDRESS;

  const { data: owner } = useReadContract({
    address: POOL_ADDRESS,
    chainId: giwaSepolia.id,
    abi: AriwaSwapPoolABI,
    functionName: "owner",
    query: { enabled: poolConfigured },
  });

  const { data: tokensPerEth, refetch: refetchPrice } = useReadContract({
    address: POOL_ADDRESS,
    chainId: giwaSepolia.id,
    abi: AriwaSwapPoolABI,
    functionName: "tokensPerEth",
    query: { enabled: poolConfigured, refetchInterval: 10_000 },
  });

  const { data: feeBps, refetch: refetchFee } = useReadContract({
    address: POOL_ADDRESS,
    chainId: giwaSepolia.id,
    abi: AriwaSwapPoolABI,
    functionName: "feeBps",
    query: { enabled: poolConfigured },
  });

  const { data: paused, refetch: refetchPaused } = useReadContract({
    address: POOL_ADDRESS,
    chainId: giwaSepolia.id,
    abi: AriwaSwapPoolABI,
    functionName: "paused",
    query: { enabled: poolConfigured },
  });

  const { data: tokenAddress } = useReadContract({
    address: POOL_ADDRESS,
    chainId: giwaSepolia.id,
    abi: AriwaSwapPoolABI,
    functionName: "token",
    query: { enabled: poolConfigured },
  });

  const poolToken =
    typeof tokenAddress === "string" && isAddress(tokenAddress)
      ? tokenAddress
      : undefined;

  const { data: ethBalance, refetch: refetchEthBalance } = useBalance({
    address: POOL_ADDRESS,
    chainId: giwaSepolia.id,
    query: { enabled: poolConfigured },
  });

  const { data: tokenBalance, refetch: refetchTokenBalance } = useBalance({
    address: POOL_ADDRESS,
    token: poolToken,
    chainId: giwaSepolia.id,
    query: { enabled: poolConfigured && !!poolToken },
  });

  const { data: walletEth, refetch: refetchWalletEth } = useBalance({
    address,
    chainId: giwaSepolia.id,
    query: { enabled: !!address },
  });

  const { data: walletToken, refetch: refetchWalletToken } = useBalance({
    address,
    token: poolToken,
    chainId: giwaSepolia.id,
    query: { enabled: !!address && !!poolToken },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: poolToken,
    abi: AriwaTokenABI,
    functionName: "allowance",
    args: [address ?? ZERO_ADDRESS, POOL_ADDRESS ?? ZERO_ADDRESS],
    chainId: giwaSepolia.id,
    query: { enabled: !!address && !!poolToken && poolConfigured },
  });

  // Drafts stay null until the user edits, so the inputs can follow on-chain
  // data and the connected wallet without syncing state inside an effect.
  const [feeDraft, setFeeDraft] = useState<string | null>(null);
  const [ethRecipientDraft, setEthRecipientDraft] = useState<string | null>(null);
  const [ethAmountInput, setEthAmountInput] = useState("");
  const [tokenRecipientDraft, setTokenRecipientDraft] = useState<string | null>(null);
  const [tokenAmountInput, setTokenAmountInput] = useState("");
  const [ethAddInput, setEthAddInput] = useState("");
  const [tokenAddInput, setTokenAddInput] = useState("");

  /** Deposit queued behind the ARIWA approval, replayed once it confirms. */
  const pendingLiquidity = useRef<{ eth: bigint; tokens: bigint } | null>(null);

  const feeInput =
    feeDraft ??
    (feeBps !== undefined ? (Number(feeBps) / 100).toFixed(2) : "");
  const ethRecipient = ethRecipientDraft ?? address ?? "";
  const tokenRecipient = tokenRecipientDraft ?? address ?? "";

  const isOwner = Boolean(
    address && owner && address.toLowerCase() === owner.toLowerCase()
  );
  const canWrite = poolConfigured && isOwner;
  const isPaused = paused === true;

  const refetchAll = () => {
    void refetchPrice();
    void refetchFee();
    void refetchPaused();
    void refetchEthBalance();
    void refetchTokenBalance();
    void refetchWalletEth();
    void refetchWalletToken();
    void refetchAllowance();
  };

  const feeTx = useTxAction("Swap fee updated", refetchFee);
  const pauseTx = useTxAction("Trading status updated", refetchPaused);
  const ethWithdrawTx = useTxAction("ETH withdrawn", refetchEthBalance);
  const tokenWithdrawTx = useTxAction("ARIWA withdrawn", refetchTokenBalance);

  const addLiquidityTx = useTxAction("Liquidity added to the pool", () => {
    void refetchEthBalance();
    void refetchTokenBalance();
    void refetchWalletEth();
    void refetchWalletToken();
    void refetchAllowance();
    setEthAddInput("");
    setTokenAddInput("");
  });

  const submitLiquidity = (ethAmount: bigint, tokenAmount: bigint) => {
    if (!POOL_ADDRESS) return;
    addLiquidityTx.writeContract({
      address: POOL_ADDRESS,
      chainId: giwaSepolia.id,
      abi: AriwaSwapPoolABI,
      functionName: "addLiquidity",
      args: [tokenAmount],
      value: ethAmount,
    });
  };

  const approveLiquidityTx = useTxAction(
    "ARIWA approved",
    () => {
      void refetchAllowance();
      const queued = pendingLiquidity.current;
      pendingLiquidity.current = null;
      if (queued) submitLiquidity(queued.eth, queued.tokens);
    },
    () => {
      pendingLiquidity.current = null;
    },
  );

  const handleTogglePause = () => {
    if (!POOL_ADDRESS) return;
    pauseTx.writeContract({
      address: POOL_ADDRESS,
      chainId: giwaSepolia.id,
      abi: AriwaSwapPoolABI,
      functionName: isPaused ? "unpause" : "pause",
    });
  };

  const handleSaveFee = () => {
    if (!POOL_ADDRESS) return;

    if (feeInput.trim() === "") {
      toast.error("Enter a fee percentage");
      return;
    }

    const percent = Number(feeInput);
    if (!Number.isFinite(percent) || percent < 0 || percent > 5) {
      toast.error("Fee must be between 0% and 5%");
      return;
    }

    const bps = Math.round(percent * 100);

    feeTx.writeContract({
      address: POOL_ADDRESS,
      chainId: giwaSepolia.id,
      abi: AriwaSwapPoolABI,
      functionName: "setFee",
      args: [BigInt(bps)],
    });
  };

  const handleWithdrawEth = () => {
    if (!POOL_ADDRESS) return;

    if (!isAddress(ethRecipient)) {
      toast.error("Enter a valid ETH recipient address");
      return;
    }

    const amount = parseAmount(ethAmountInput);
    if (amount === null || amount <= 0n) {
      toast.error("Enter a valid ETH amount");
      return;
    }

    if (ethBalance !== undefined && amount > ethBalance.value) {
      toast.error("Amount exceeds the pool's ETH reserve");
      return;
    }

    ethWithdrawTx.writeContract({
      address: POOL_ADDRESS,
      chainId: giwaSepolia.id,
      abi: AriwaSwapPoolABI,
      functionName: "withdrawEth",
      args: [ethRecipient, amount],
    });
  };

  const handleWithdrawTokens = () => {
    if (!POOL_ADDRESS) return;

    if (!isAddress(tokenRecipient)) {
      toast.error("Enter a valid ARIWA recipient address");
      return;
    }

    const amount = parseAmount(tokenAmountInput);
    if (amount === null || amount <= 0n) {
      toast.error("Enter a valid ARIWA amount");
      return;
    }

    if (tokenBalance !== undefined && amount > tokenBalance.value) {
      toast.error("Amount exceeds the pool's ARIWA reserve");
      return;
    }

    tokenWithdrawTx.writeContract({
      address: POOL_ADDRESS,
      chainId: giwaSepolia.id,
      abi: AriwaSwapPoolABI,
      functionName: "withdrawTokens",
      args: [tokenRecipient, amount],
    });
  };

  const handleResetForm = () => {
    setFeeDraft(null);
    setEthAmountInput("");
    setTokenAmountInput("");
    setEthAddInput("");
    setTokenAddInput("");
    pendingLiquidity.current = null;
    refetchAll();
  };

  const fillMaxEth = () => {
    if (!walletEth) return;
    const spendable =
      walletEth.value > ETH_GAS_BUFFER ? walletEth.value - ETH_GAS_BUFFER : 0n;
    setEthAddInput(spendable > 0n ? formatEther(spendable) : "");
  };

  const handleAddLiquidity = () => {
    if (!POOL_ADDRESS) return;

    const ethAmount = ethAddInput.trim() ? parseAmount(ethAddInput) : 0n;
    const tokenAmount = tokenAddInput.trim() ? parseAmount(tokenAddInput) : 0n;

    if (ethAmount === null || tokenAmount === null) {
      toast.error("Enter a valid amount using up to 18 decimals");
      return;
    }

    if (ethAmount === 0n && tokenAmount === 0n) {
      toast.error("Enter an ETH or ARIWA amount");
      return;
    }

    if (
      ethAmount > 0n &&
      walletEth !== undefined &&
      ethAmount + ETH_GAS_BUFFER > walletEth.value
    ) {
      toast.error("That ETH amount plus gas exceeds this wallet's balance");
      return;
    }

    if (
      tokenAmount > 0n &&
      walletToken !== undefined &&
      tokenAmount > walletToken.value
    ) {
      toast.error("Amount exceeds this wallet's ARIWA balance");
      return;
    }

    if (tokenAmount > 0n) {
      if (allowance === undefined) {
        toast.error("Still reading the pool allowance — try again in a moment");
        return;
      }

      if ((allowance as bigint) < tokenAmount) {
        if (!poolToken) {
          toast.error("The pool's token address is still loading");
          return;
        }

        pendingLiquidity.current = { eth: ethAmount, tokens: tokenAmount };
        approveLiquidityTx.writeContract({
          address: poolToken,
          chainId: giwaSepolia.id,
          abi: AriwaTokenABI,
          functionName: "approve",
          args: [POOL_ADDRESS, tokenAmount],
        });
        return;
      }
    }

    submitLiquidity(ethAmount, tokenAmount);
  };

  const addEthAmount = ethAddInput.trim() ? parseAmount(ethAddInput) : 0n;
  const addTokenAmount = tokenAddInput.trim() ? parseAmount(tokenAddInput) : 0n;
  const addHasAmount =
    addEthAmount !== null &&
    addTokenAmount !== null &&
    (addEthAmount > 0n || addTokenAmount > 0n);
  const addNeedsApproval =
    addTokenAmount !== null &&
    addTokenAmount > 0n &&
    allowance !== undefined &&
    (allowance as bigint) < addTokenAmount;
  const addAllowanceUnknown =
    addTokenAmount !== null && addTokenAmount > 0n && allowance === undefined;
  const addBusy =
    addLiquidityTx.isPending ||
    addLiquidityTx.isConfirming ||
    approveLiquidityTx.isPending ||
    approveLiquidityTx.isConfirming;

  let addLiquidityLabel = "Add liquidity";
  if (!address) addLiquidityLabel = "Connect a wallet to fund";
  else if (approveLiquidityTx.isPending) addLiquidityLabel = "Confirm approval in wallet…";
  else if (approveLiquidityTx.isConfirming) addLiquidityLabel = "Approving ARIWA…";
  else if (addLiquidityTx.isPending) addLiquidityLabel = "Confirm deposit in wallet…";
  else if (addLiquidityTx.isConfirming) addLiquidityLabel = "Adding liquidity…";
  else if (!addHasAmount) addLiquidityLabel = "Enter an amount";
  else if (addAllowanceUnknown) addLiquidityLabel = "Checking allowance…";
  else if (addNeedsApproval) addLiquidityLabel = "Approve & add liquidity";

  return (
    <div className="space-y-6">
      {!poolConfigured && (
        <div className="ui-container rounded border border-orange-500/20 bg-orange-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-orange-700 dark:text-orange-300">
            <span className="material-symbols-outlined text-base">warning</span>
            Swap pool address not configured
          </p>
          <p className="mt-1 text-xs text-muted-blue">
            Run{" "}
            <code className="rounded bg-ink/[0.04] px-1.5 py-0.5 font-mono">
              npx hardhat run scripts/deploy-swap-pool.ts --network giwaSepolia
            </code>{" "}
            and add{" "}
            <code className="rounded bg-ink/[0.04] px-1.5 py-0.5 font-mono">
              NEXT_PUBLIC_SWAP_POOL_ADDRESS
            </code>{" "}
            to <code className="rounded bg-ink/[0.04] px-1.5 py-0.5 font-mono">.env.local</code>.
          </p>
        </div>
      )}

      {poolConfigured && address && owner && !isOwner && (
        <div className="ui-container rounded border border-orange-500/20 bg-orange-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-orange-700 dark:text-orange-300">
            <span className="material-symbols-outlined text-base">warning</span>
            This wallet is not the pool owner
          </p>
          <p className="mt-1 text-xs text-muted-blue">
            The owner is <span className="font-mono">{owner}</span>. Connect the
            owner wallet to change the swap fee, pause trading, or withdraw
            reserves.
            Adding liquidity below is open to any wallet.
          </p>
        </div>
      )}

      {/* On-chain settings */}
      <div className="ui-container rounded overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-6 py-4">
          <div>
            <h3 className="text-xl font-header text-text-primary">
              On-chain pool settings
            </h3>
            <p className="mt-1 text-[11px] text-muted-blue">
              The price is set by the pool&apos;s x × y = k curve, so only the
              swap fee and pause switch live in the AriwaSwapPool contract. Only
              the owner can change them or withdraw reserves.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                isPaused
                  ? "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {isPaused ? "Trading paused" : "Trading live"}
            </span>
            <button
              onClick={handleTogglePause}
              disabled={!canWrite || pauseTx.isPending || pauseTx.isConfirming}
              className="rounded border border-ink/10 bg-paper px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-text-primary transition-all hover:bg-ink/[0.04] disabled:opacity-40"
            >
              {pauseTx.isPending
                ? "Confirm…"
                : pauseTx.isConfirming
                  ? "Saving…"
                  : isPaused
                    ? "Resume trading"
                    : "Pause trading"}
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-3">
              <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                Live price
              </dt>
              <dd className="mt-2 text-sm font-bold text-text-primary">
                {tokensPerEth !== undefined
                  ? `${formatTokenAmount(tokensPerEth, 2)} ARIWA / ETH`
                  : "…"}
              </dd>
            </div>
            <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-3">
              <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                Swap fee
              </dt>
              <dd className="mt-2 text-sm font-bold text-text-primary">
                {feeBps !== undefined
                  ? `${(Number(feeBps) / 100).toFixed(2)}%`
                  : "…"}
              </dd>
            </div>
            <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-3">
              <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                ETH reserve
              </dt>
              <dd className="mt-2 text-sm font-bold text-text-primary">
                {ethBalance
                  ? `${formatTokenAmount(ethBalance.value)} ${ethBalance.symbol}`
                  : "…"}
              </dd>
            </div>
            <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-3">
              <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                ARIWA reserve
              </dt>
              <dd className="mt-2 text-sm font-bold text-text-primary">
                {tokenBalance
                  ? `${formatTokenAmount(tokenBalance.value)} ${tokenBalance.symbol}`
                  : "…"}
              </dd>
            </div>
            <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-3">
              <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                Owner
              </dt>
              <dd className="mt-2 truncate font-mono text-[10px] text-text-primary">
                {owner ?? "…"}
              </dd>
            </div>
          </dl>

          <label className="block border-t border-ink/10 pt-4">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-blue">
              Swap fee (%)
            </span>
            <div className="flex gap-2">
              <input
                value={feeInput}
                onChange={(event) => setFeeDraft(event.target.value)}
                placeholder="0.30"
                inputMode="decimal"
                className={`${inputClass} py-2.5`}
              />
              <button
                onClick={handleSaveFee}
                disabled={!canWrite || feeTx.isPending || feeTx.isConfirming}
                className="whitespace-nowrap rounded border border-ink/10 bg-paper px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-text-primary transition-all hover:bg-ink/[0.04] disabled:opacity-40"
              >
                {feeTx.isPending
                  ? "Confirm…"
                  : feeTx.isConfirming
                    ? "Saving…"
                    : "Update fee"}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] leading-4 text-muted-blue">
              The fee is taken from the input of every trade and stays in the
              reserves for liquidity providers. Capped at 5%. The price itself is
              set by the curve and cannot be overridden.
            </p>
          </label>

          <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-4">
            <button
              onClick={handleResetForm}
              disabled={!poolConfigured}
              className="rounded border border-ink/10 bg-paper px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-text-primary transition-all hover:bg-ink/[0.04] disabled:opacity-40"
            >
              Reset from chain
            </button>
            {POOL_ADDRESS && (
              <a
                href={`https://sepolia-explorer.giwa.io/address/${POOL_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto font-mono text-[10px] text-iris hover:underline"
              >
                {POOL_ADDRESS.slice(0, 6)}…{POOL_ADDRESS.slice(-4)}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Funding */}
      <div className="ui-container rounded overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-6 py-4">
          <div>
            <h3 className="text-xl font-header text-text-primary">Add liquidity</h3>
            <p className="mt-1 text-[11px] text-muted-blue">
              Top up the pool&apos;s reserves. Buys fail when ARIWA runs short and
              sells fail when ETH runs short. Adding one side also moves the
              market price along the curve. Funding is permissionless — any
              connected wallet can deposit.
            </p>
          </div>
          <span className="rounded border border-ink/10 bg-ink/[0.02] px-3 py-1 font-mono text-[10px] text-muted-blue">
            {tokensPerEth !== undefined
              ? `${formatTokenAmount(tokensPerEth)} ARIWA / ETH`
              : "…"}
          </span>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                ETH to add
                <span className="font-mono font-normal normal-case tracking-normal">
                  Wallet {walletEth ? `${formatTokenAmount(walletEth.value)} ETH` : "…"}
                </span>
              </span>
              <div className="flex gap-2">
                <input
                  value={ethAddInput}
                  onChange={(event) => setEthAddInput(event.target.value)}
                  disabled={addBusy}
                  inputMode="decimal"
                  placeholder="0.1"
                  className={`${inputClass} font-mono`}
                />
                <button
                  onClick={fillMaxEth}
                  disabled={addBusy || !walletEth || walletEth.value <= ETH_GAS_BUFFER}
                  className="whitespace-nowrap rounded border border-ink/10 bg-paper px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-text-primary transition-all hover:bg-ink/[0.04] disabled:opacity-40"
                >
                  Max
                </button>
              </div>
            </label>

            <label className="block">
              <span className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                ARIWA to add
                <span className="font-mono font-normal normal-case tracking-normal">
                  Wallet{" "}
                  {walletToken ? `${formatTokenAmount(walletToken.value)} ARIWA` : "…"}
                </span>
              </span>
              <div className="flex gap-2">
                <input
                  value={tokenAddInput}
                  onChange={(event) => setTokenAddInput(event.target.value)}
                  disabled={addBusy}
                  inputMode="decimal"
                  placeholder="1000"
                  className={`${inputClass} font-mono`}
                />
                <button
                  onClick={() =>
                    walletToken && setTokenAddInput(formatEther(walletToken.value))
                  }
                  disabled={addBusy || !walletToken || walletToken.value === 0n}
                  className="whitespace-nowrap rounded border border-ink/10 bg-paper px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-text-primary transition-all hover:bg-ink/[0.04] disabled:opacity-40"
                >
                  Max
                </button>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-ink/[0.02] px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
              Pool holds
            </span>
            <span className="font-mono text-[11px] font-bold text-text-primary">
              {ethBalance ? `${formatTokenAmount(ethBalance.value)} ETH` : "…"} /{" "}
              {tokenBalance ? `${formatTokenAmount(tokenBalance.value)} ARIWA` : "…"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleAddLiquidity}
              disabled={
                !poolConfigured ||
                !address ||
                addBusy ||
                !addHasAmount ||
                addAllowanceUnknown
              }
              className="rounded border border-ink/10 bg-paper px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-text-primary transition-all hover:bg-ink/[0.04] disabled:opacity-40"
            >
              {addLiquidityLabel}
            </button>
            <p className="max-w-md text-[10px] leading-4 text-muted-blue">
              {addNeedsApproval
                ? "Two wallet prompts: approve the ARIWA amount, then the deposit lands in a single transaction."
                : "Deposits land straight in the contract's reserves and are tradeable immediately."}
            </p>
          </div>
        </div>
      </div>

      {/* Owner withdrawals */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="ui-container rounded overflow-hidden">
          <div className="border-b border-ink/10 px-6 py-4">
            <h3 className="text-xl font-header text-text-primary">
              Withdraw ETH
            </h3>
            <p className="mt-1 text-[11px] text-muted-blue">
              Send part or all of the pool&apos;s ETH reserve to any address.
            </p>
          </div>
          <div className="space-y-3 p-6">
            <div className="flex items-center justify-between rounded-lg border border-ink/10 bg-ink/[0.02] px-4 py-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                Reserve
              </span>
              <span className="font-mono text-sm font-bold text-text-primary">
                {ethBalance
                  ? `${formatTokenAmount(ethBalance.value)} ${ethBalance.symbol}`
                  : "…"}
              </span>
            </div>
            <input
              value={ethRecipient}
              onChange={(event) => setEthRecipientDraft(event.target.value)}
              placeholder="0x… recipient address"
              spellCheck={false}
              className={`${inputClass} font-mono`}
            />
            <div className="flex gap-2">
              <input
                value={ethAmountInput}
                onChange={(event) => setEthAmountInput(event.target.value)}
                inputMode="decimal"
                placeholder="0.01"
                className={`${inputClass} font-mono`}
              />
              <button
                onClick={() =>
                  ethBalance && setEthAmountInput(formatEther(ethBalance.value))
                }
                disabled={!ethBalance || ethBalance.value === 0n}
                className="whitespace-nowrap rounded border border-ink/10 bg-paper px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-text-primary transition-all hover:bg-ink/[0.04] disabled:opacity-40"
              >
                Max
              </button>
            </div>
            <button
              onClick={handleWithdrawEth}
              disabled={
                !canWrite || ethWithdrawTx.isPending || ethWithdrawTx.isConfirming
              }
              className="rounded border border-ink/10 bg-paper px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-text-primary transition-all hover:bg-ink/[0.04] disabled:opacity-40"
            >
              {ethWithdrawTx.isPending
                ? "Confirm in wallet…"
                : ethWithdrawTx.isConfirming
                  ? "Sending…"
                  : "Withdraw ETH"}
            </button>
            <p className="text-[10px] leading-4 text-muted-blue">
              Transfers immediately. Leave enough behind to cover sells.
            </p>
          </div>
        </div>

        <div className="ui-container rounded overflow-hidden">
          <div className="border-b border-ink/10 px-6 py-4">
            <h3 className="text-xl font-header text-text-primary">
              Withdraw ARIWA
            </h3>
            <p className="mt-1 text-[11px] text-muted-blue">
              Send part or all of the pool&apos;s ARIWA reserve to any address.
            </p>
          </div>
          <div className="space-y-3 p-6">
            <div className="flex items-center justify-between rounded-lg border border-ink/10 bg-ink/[0.02] px-4 py-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                Reserve
              </span>
              <span className="font-mono text-sm font-bold text-text-primary">
                {tokenBalance
                  ? `${formatTokenAmount(tokenBalance.value)} ${tokenBalance.symbol}`
                  : "…"}
              </span>
            </div>
            <input
              value={tokenRecipient}
              onChange={(event) => setTokenRecipientDraft(event.target.value)}
              placeholder="0x… recipient address"
              spellCheck={false}
              className={`${inputClass} font-mono`}
            />
            <div className="flex gap-2">
              <input
                value={tokenAmountInput}
                onChange={(event) => setTokenAmountInput(event.target.value)}
                inputMode="decimal"
                placeholder="100"
                className={`${inputClass} font-mono`}
              />
              <button
                onClick={() =>
                  tokenBalance &&
                  setTokenAmountInput(formatEther(tokenBalance.value))
                }
                disabled={!tokenBalance || tokenBalance.value === 0n}
                className="whitespace-nowrap rounded border border-ink/10 bg-paper px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-text-primary transition-all hover:bg-ink/[0.04] disabled:opacity-40"
              >
                Max
              </button>
            </div>
            <button
              onClick={handleWithdrawTokens}
              disabled={
                !canWrite ||
                tokenWithdrawTx.isPending ||
                tokenWithdrawTx.isConfirming
              }
              className="rounded border border-ink/10 bg-paper px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-text-primary transition-all hover:bg-ink/[0.04] disabled:opacity-40"
            >
              {tokenWithdrawTx.isPending
                ? "Confirm in wallet…"
                : tokenWithdrawTx.isConfirming
                  ? "Sending…"
                  : "Withdraw ARIWA"}
            </button>
            <p className="text-[10px] leading-4 text-muted-blue">
              Transfers immediately. Leave enough behind for buys to fill.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
