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
import { AriwaSwapPoolABI, giwaSepolia, SWAP_POOL_ADDRESS } from "@/lib/contracts";

const POOL_ADDRESS =
  SWAP_POOL_ADDRESS && isAddress(SWAP_POOL_ADDRESS) ? SWAP_POOL_ADDRESS : undefined;

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

/**
 * Small wrapper around a single write + receipt pair. Success callbacks are
 * kept in a ref so callers can pass inline functions without re-subscribing.
 */
function useTxAction(successMessage: string, onSuccess?: () => void) {
  const successRef = useRef(onSuccess);

  useEffect(() => {
    successRef.current = onSuccess;
  }, [onSuccess]);

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

  const { data: tokensPerEth, refetch: refetchRate } = useReadContract({
    address: POOL_ADDRESS,
    chainId: giwaSepolia.id,
    abi: AriwaSwapPoolABI,
    functionName: "tokensPerEth",
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

  // Drafts stay null until the user edits, so the inputs can follow on-chain
  // data and the connected wallet without syncing state inside an effect.
  const [rateDraft, setRateDraft] = useState<string | null>(null);
  const [ethRecipientDraft, setEthRecipientDraft] = useState<string | null>(null);
  const [ethAmountInput, setEthAmountInput] = useState("");
  const [tokenRecipientDraft, setTokenRecipientDraft] = useState<string | null>(null);
  const [tokenAmountInput, setTokenAmountInput] = useState("");

  const rateInput =
    rateDraft ??
    (tokensPerEth !== undefined ? formatEther(tokensPerEth) : "");
  const ethRecipient = ethRecipientDraft ?? address ?? "";
  const tokenRecipient = tokenRecipientDraft ?? address ?? "";

  const isOwner = Boolean(
    address && owner && address.toLowerCase() === owner.toLowerCase()
  );
  const canWrite = poolConfigured && isOwner;
  const isPaused = paused === true;

  const refetchAll = () => {
    void refetchRate();
    void refetchPaused();
    void refetchEthBalance();
    void refetchTokenBalance();
  };

  const rateTx = useTxAction("Pool rate updated", refetchRate);
  const pauseTx = useTxAction("Trading status updated", refetchPaused);
  const ethWithdrawTx = useTxAction("ETH withdrawn", refetchEthBalance);
  const tokenWithdrawTx = useTxAction("ARIWA withdrawn", refetchTokenBalance);

  const handleTogglePause = () => {
    if (!POOL_ADDRESS) return;
    pauseTx.writeContract({
      address: POOL_ADDRESS,
      chainId: giwaSepolia.id,
      abi: AriwaSwapPoolABI,
      functionName: isPaused ? "unpause" : "pause",
    });
  };

  const handleSaveRate = () => {
    if (!POOL_ADDRESS) return;

    const rate = parseAmount(rateInput);
    if (rate === null || rate <= 0n) {
      toast.error("Rate must be a positive ARIWA amount");
      return;
    }

    rateTx.writeContract({
      address: POOL_ADDRESS,
      chainId: giwaSepolia.id,
      abi: AriwaSwapPoolABI,
      functionName: "setRate",
      args: [rate],
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
    setRateDraft(null);
    setEthAmountInput("");
    setTokenAmountInput("");
    refetchAll();
  };

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
            owner wallet to manage the pool. Every action below is a contract
            transaction signed by the owner.
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
              The fixed rate and pause switch live in the AriwaSwapPool contract.
              Only the owner can change them or withdraw reserves.
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
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-3">
              <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                Rate
              </dt>
              <dd className="mt-2 text-sm font-bold text-text-primary">
                {tokensPerEth !== undefined
                  ? `${formatEther(tokensPerEth)} ARIWA / ETH`
                  : "…"}
              </dd>
            </div>
            <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-3">
              <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                ETH reserve
              </dt>
              <dd className="mt-2 text-sm font-bold text-text-primary">
                {ethBalance
                  ? `${formatEther(ethBalance.value)} ${ethBalance.symbol}`
                  : "…"}
              </dd>
            </div>
            <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-3">
              <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                ARIWA reserve
              </dt>
              <dd className="mt-2 text-sm font-bold text-text-primary">
                {tokenBalance
                  ? `${formatEther(tokenBalance.value)} ${tokenBalance.symbol}`
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
              ARIWA per 1 ETH
            </span>
            <div className="flex gap-2">
              <input
                value={rateInput}
                onChange={(event) => setRateDraft(event.target.value)}
                placeholder="10000"
                className={`${inputClass} py-2.5`}
              />
              <button
                onClick={handleSaveRate}
                disabled={!canWrite || rateTx.isPending || rateTx.isConfirming}
                className="whitespace-nowrap rounded border border-ink/10 bg-paper px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-text-primary transition-all hover:bg-ink/[0.04] disabled:opacity-40"
              >
                {rateTx.isPending
                  ? "Confirm…"
                  : rateTx.isConfirming
                    ? "Saving…"
                    : "Update rate"}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] leading-4 text-muted-blue">
              Used for both directions: buying pays this rate and selling unwinds
              it. Changing the rate does not move existing reserves.
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
                  ? `${formatEther(ethBalance.value)} ${ethBalance.symbol}`
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
                  ? `${formatEther(tokenBalance.value)} ${tokenBalance.symbol}`
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
