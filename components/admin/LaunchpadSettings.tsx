"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatEther, isAddress, parseEther } from "viem";
import { toast } from "sonner";
import { AriwaNFTABI, giwaSepolia, LAUNCHPAD_NFT_ADDRESS } from "@/lib/contracts";
import { useConfig } from "@/lib/hooks";
import {
  HOLDER_CHAINS,
  HOLDER_CHAIN_KEYS,
  type HolderChainKey,
} from "@/lib/launchpad/chains";
import {
  HOLDER_REQUIREMENTS_CONFIG_KEY,
  getDefaultHolderRequirements,
  parseHolderRequirements,
  serializeHolderRequirements,
  type HolderRequirement,
} from "@/lib/launchpad/config";
import { formatCompactNumber } from "@/lib/utils/format";

const CONTRACT_ADDRESS =
  LAUNCHPAD_NFT_ADDRESS && isAddress(LAUNCHPAD_NFT_ADDRESS)
    ? LAUNCHPAD_NFT_ADDRESS
    : undefined;

const inputClass =
  "w-full rounded border border-ink/10 bg-paper px-4 py-3 text-sm text-text-primary placeholder:text-ink/30 focus:border-iris/50 focus:outline-none focus:ring-1 focus:ring-iris/30";

function shortError(error: Error): string {
  const withShort = error as Error & { shortMessage?: string };
  return (withShort.shortMessage || error.message).split("\n")[0];
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

function emptyHolderState(): Record<
  HolderChainKey,
  { enabled: boolean; minAmount: string }
> {
  return HOLDER_CHAIN_KEYS.reduce(
    (accumulator, chain) => {
      accumulator[chain] = {
        enabled: false,
        // The chain and native currency are fixed; only the minimum is edited.
        minAmount: HOLDER_CHAINS[chain].defaultMinAmount,
      };
      return accumulator;
    },
    {} as Record<HolderChainKey, { enabled: boolean; minAmount: string }>
  );
}

export function LaunchpadSettings() {
  const { address } = useAccount();

  const contractConfigured = !!CONTRACT_ADDRESS;

  const { data: publicMintOpen, refetch: refetchMintOpen } = useReadContract({
    address: CONTRACT_ADDRESS,
    chainId: giwaSepolia.id,
    abi: AriwaNFTABI,
    functionName: "publicMintOpen",
    query: { enabled: contractConfigured },
  });

  const { data: publicPrice, refetch: refetchPublicPrice } = useReadContract({
    address: CONTRACT_ADDRESS,
    chainId: giwaSepolia.id,
    abi: AriwaNFTABI,
    functionName: "publicPrice",
    query: { enabled: contractConfigured },
  });

  const { data: maxPerWallet, refetch: refetchMaxPerWallet } = useReadContract({
    address: CONTRACT_ADDRESS,
    chainId: giwaSepolia.id,
    abi: AriwaNFTABI,
    functionName: "maxPerWallet",
    query: { enabled: contractConfigured },
  });

  const { data: totalMinted, refetch: refetchTotalMinted } = useReadContract({
    address: CONTRACT_ADDRESS,
    chainId: giwaSepolia.id,
    abi: AriwaNFTABI,
    functionName: "totalMinted",
    query: { enabled: contractConfigured },
  });

  const { data: maxSupply } = useReadContract({
    address: CONTRACT_ADDRESS,
    chainId: giwaSepolia.id,
    abi: AriwaNFTABI,
    functionName: "maxSupply",
    query: { enabled: contractConfigured },
  });

  const { data: collectionName } = useReadContract({
    address: CONTRACT_ADDRESS,
    chainId: giwaSepolia.id,
    abi: AriwaNFTABI,
    functionName: "name",
    query: { enabled: contractConfigured },
  });

  const { data: collectionSymbol } = useReadContract({
    address: CONTRACT_ADDRESS,
    chainId: giwaSepolia.id,
    abi: AriwaNFTABI,
    functionName: "symbol",
    query: { enabled: contractConfigured },
  });

  const { data: owner } = useReadContract({
    address: CONTRACT_ADDRESS,
    chainId: giwaSepolia.id,
    abi: AriwaNFTABI,
    functionName: "owner",
    query: { enabled: contractConfigured },
  });

  const {
    data: probeTokenUri,
    refetch: refetchBaseUri,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    chainId: giwaSepolia.id,
    abi: AriwaNFTABI,
    functionName: "tokenURI",
    args: [1n],
    query: {
      // `tokenURI` reverts for nonexistent tokens; only probe it once token 1
      // has been minted.
      enabled:
        contractConfigured && totalMinted !== undefined && totalMinted > 0n,
      retry: false,
    },
  });

  const {
    data: contractBalance,
    refetch: refetchContractBalance,
  } = useBalance({
    address: CONTRACT_ADDRESS,
    chainId: giwaSepolia.id,
    query: { enabled: contractConfigured },
  });

  const [priceInput, setPriceInput] = useState("");
  const [maxPerWalletInput, setMaxPerWalletInput] = useState("");
  const [baseUriInput, setBaseUriInput] = useState("");
  const [mintTo, setMintTo] = useState("");
  const [mintQuantity, setMintQuantity] = useState("1");
  const [withdrawTo, setWithdrawTo] = useState("");

  // The contract exposes the base URI only through `tokenURI`, so derive it
  // from token 1 when that token exists. Before the first mint there is
  // nothing to read back.
  const derivedBaseUri =
    typeof probeTokenUri === "string" && probeTokenUri.endsWith("1.json")
      ? probeTokenUri.slice(0, -"1.json".length)
      : undefined;

  useEffect(() => {
    if (publicPrice !== undefined && !priceInput) {
      setPriceInput(formatEther(publicPrice));
    }
  }, [publicPrice, priceInput]);

  useEffect(() => {
    if (maxPerWallet !== undefined && !maxPerWalletInput) {
      setMaxPerWalletInput(maxPerWallet.toString());
    }
  }, [maxPerWallet, maxPerWalletInput]);

  useEffect(() => {
    if (derivedBaseUri && !baseUriInput) {
      setBaseUriInput(derivedBaseUri);
    }
  }, [derivedBaseUri, baseUriInput]);

  useEffect(() => {
    if (address && !withdrawTo) {
      setWithdrawTo(address);
    }
  }, [address, withdrawTo]);

  const isOwner = Boolean(
    address && owner && address.toLowerCase() === owner.toLowerCase()
  );
  const canWrite = contractConfigured && isOwner;

  const isOpen = publicMintOpen === true;

  const refetchAll = () => {
    void refetchMintOpen();
    void refetchPublicPrice();
    void refetchMaxPerWallet();
    void refetchTotalMinted();
    void refetchContractBalance();
    void refetchBaseUri();
  };

  const phaseTx = useTxAction(
    isOpen ? "Public mint closed" : "Public mint opened",
    refetchAll
  );

  const priceTx = useTxAction("Public price updated", () => {
    void refetchPublicPrice();
  });

  const maxPerWalletTx = useTxAction("Max per wallet updated", () => {
    void refetchMaxPerWallet();
  });

  const baseUriTx = useTxAction("Base URI updated", () => {
    void refetchBaseUri();
  });

  const ownerMintTx = useTxAction("Owner mint confirmed", () => {
    void refetchTotalMinted();
  });

  const withdrawTx = useTxAction("Fees withdrawn", () => {
    void refetchContractBalance();
  });

  const handleTogglePhase = () => {
    if (!CONTRACT_ADDRESS) return;
    phaseTx.writeContract({
      address: CONTRACT_ADDRESS,
      chainId: giwaSepolia.id,
      abi: AriwaNFTABI,
      functionName: "setPublicMintOpen",
      args: [!isOpen],
    });
  };

  const handleSaveMaxPerWallet = () => {
    if (!CONTRACT_ADDRESS) return;

    const value = Number.parseInt(maxPerWalletInput, 10);
    if (!Number.isSafeInteger(value) || value < 1 || value > 5_000) {
      toast.error("Max per wallet must be a whole number between 1 and 5,000");
      return;
    }

    maxPerWalletTx.writeContract({
      address: CONTRACT_ADDRESS,
      chainId: giwaSepolia.id,
      abi: AriwaNFTABI,
      functionName: "setMaxPerWallet",
      args: [BigInt(value)],
    });
  };

  const handleSavePrice = () => {
    if (!CONTRACT_ADDRESS) return;

    let priceWei: bigint;
    try {
      const trimmed = priceInput.trim();
      if (!/^\d+(\.\d{1,18})?$/.test(trimmed)) {
        throw new Error("invalid amount");
      }
      priceWei = parseEther(trimmed);
    } catch {
      toast.error("Mint price must be a valid ETH amount");
      return;
    }

    priceTx.writeContract({
      address: CONTRACT_ADDRESS,
      chainId: giwaSepolia.id,
      abi: AriwaNFTABI,
      functionName: "setPublicPrice",
      args: [priceWei],
    });
  };

  const handleSaveBaseUri = () => {
    if (!CONTRACT_ADDRESS) return;
    const value = baseUriInput.trim();
    if (!value) {
      toast.error("Enter a base URI");
      return;
    }
    baseUriTx.writeContract({
      address: CONTRACT_ADDRESS,
      chainId: giwaSepolia.id,
      abi: AriwaNFTABI,
      functionName: "setBaseURI",
      args: [value],
    });
  };

  const handleOwnerMint = () => {
    if (!CONTRACT_ADDRESS) return;

    if (!isAddress(mintTo)) {
      toast.error("Enter a valid recipient address");
      return;
    }

    const quantity = Number.parseInt(mintQuantity, 10);
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      toast.error("Quantity must be a whole number of at least 1");
      return;
    }

    if (
      maxSupply !== undefined &&
      totalMinted !== undefined &&
      totalMinted + BigInt(quantity) > maxSupply
    ) {
      toast.error("That would exceed the 2,222 supply cap");
      return;
    }

    ownerMintTx.writeContract({
      address: CONTRACT_ADDRESS,
      chainId: giwaSepolia.id,
      abi: AriwaNFTABI,
      functionName: "ownerMint",
      args: [mintTo, BigInt(quantity)],
    });
  };

  const handleWithdraw = () => {
    if (!CONTRACT_ADDRESS) return;
    if (!withdrawTo || !isAddress(withdrawTo)) {
      toast.error("Enter a valid recipient address");
      return;
    }
    withdrawTx.writeContract({
      address: CONTRACT_ADDRESS,
      chainId: giwaSepolia.id,
      abi: AriwaNFTABI,
      functionName: "withdraw",
      args: [withdrawTo as `0x${string}`],
    });
  };

  const handleResetForm = () => {
    setPriceInput("");
    setMaxPerWalletInput("");
    setBaseUriInput("");
    refetchAll();
  };

  const mintProgress =
    maxSupply !== undefined && maxSupply > 0n && totalMinted !== undefined
      ? Math.min(100, (Number(totalMinted) / Number(maxSupply)) * 100)
      : undefined;

  // ─── Holder gate config ──────────────────────────────────────────────
  const {
    value: holderConfigValue,
    fetchConfig,
    updateConfig,
    isLoading: savingHolders,
    error: holderConfigError,
  } = useConfig(HOLDER_REQUIREMENTS_CONFIG_KEY, "[]");

  const [holderState, setHolderState] = useState(emptyHolderState);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    const requirements = parseHolderRequirements(holderConfigValue);
    const next = emptyHolderState();
    for (const requirement of requirements) {
      next[requirement.chain] = {
        enabled: true,
        minAmount: requirement.minAmount,
      };
    }
    setHolderState(next);
  }, [holderConfigValue]);

  const updateHolderRow = (
    chain: HolderChainKey,
    patch: Partial<{ enabled: boolean; minAmount: string }>
  ) => {
    setHolderState((current) => ({
      ...current,
      [chain]: { ...current[chain], ...patch },
    }));
  };

  const handleLoadDefaultHolderGate = () => {
    const next = emptyHolderState();
    for (const requirement of getDefaultHolderRequirements()) {
      next[requirement.chain] = {
        enabled: true,
        minAmount: requirement.minAmount,
      };
    }
    setHolderState(next);
  };

  const handleSaveHolderGate = async () => {
    const requirements: HolderRequirement[] = [];

    for (const chain of HOLDER_CHAIN_KEYS) {
      const row = holderState[chain];
      if (!row.enabled) continue;

      const amount = row.minAmount.trim();
      if (
        !/^(?:\d+(?:\.\d{1,18})?|\.\d{1,18})$/.test(amount) ||
        Number(amount) <= 0
      ) {
        toast.error(
          `Enter a valid minimum for ${HOLDER_CHAINS[chain].label}`
        );
        return;
      }

      requirements.push({ chain, minAmount: amount });
    }

    const saved = await updateConfig(
      serializeHolderRequirements(requirements)
    );
    if (saved) {
      toast.success(
        requirements.length === 0
          ? "Holder gate disabled"
          : "Holder requirements saved"
      );
    } else {
      toast.error(holderConfigError || "Could not save holder requirements");
    }
  };

  const activeRequirements = useMemo(
    () => parseHolderRequirements(holderConfigValue),
    [holderConfigValue]
  );

  return (
    <div className="space-y-6">
      {!contractConfigured && (
        <div className="ui-container rounded border border-orange-500/20 bg-orange-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-orange-700 dark:text-orange-300">
            <span className="material-symbols-outlined text-base">warning</span>
            NFT contract address not configured
          </p>
          <p className="mt-1 text-xs text-muted-blue">
            Run{" "}
            <code className="rounded bg-ink/[0.04] px-1.5 py-0.5 font-mono">
              npx hardhat run scripts/deploy-launchpad-nft.ts --network giwaSepolia
            </code>{" "}
            and add{" "}
            <code className="rounded bg-ink/[0.04] px-1.5 py-0.5 font-mono">
              NEXT_PUBLIC_LAUNCHPAD_NFT_ADDRESS
            </code>{" "}
            to <code className="rounded bg-ink/[0.04] px-1.5 py-0.5 font-mono">.env.local</code>.
          </p>
        </div>
      )}

      {contractConfigured && address && owner && !isOwner && (
        <div className="ui-container rounded border border-orange-500/20 bg-orange-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-orange-700 dark:text-orange-300">
            <span className="material-symbols-outlined text-base">warning</span>
            This wallet is not the collection owner
          </p>
          <p className="mt-1 text-xs text-muted-blue">
            The owner is <span className="font-mono">{owner}</span>. Connect the
            owner wallet to manage the collection. Every action below is a
            contract transaction signed by the owner.
          </p>
        </div>
      )}

      {/* On-chain settings */}
      <div className="ui-container rounded overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-6 py-4">
          <div>
            <h3 className="text-xl font-header text-text-primary">
              On-chain mint settings
            </h3>
            <p className="mt-1 text-[11px] text-muted-blue">
              These values live in the ARIWA NFT contract. The public phase is a
              switch the owner opens and closes on-chain; the cap and price are
              owner-controlled. Supply is fixed at 2,222.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                isOpen
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300"
              }`}
            >
              {isOpen ? "Public mint open" : "Public mint closed"}
            </span>
            <button
              onClick={handleTogglePhase}
              disabled={!canWrite || phaseTx.isPending || phaseTx.isConfirming}
              className="rounded border border-ink/10 bg-paper px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-text-primary transition-all hover:bg-ink/[0.04] disabled:opacity-40"
            >
              {phaseTx.isPending
                ? "Confirm…"
                : phaseTx.isConfirming
                  ? "Saving…"
                  : isOpen
                    ? "Close public mint"
                    : "Open public mint"}
            </button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                Current on-chain state
              </p>
              <div className="mt-2 space-y-1 text-[11px] text-muted-blue">
                <p>
                  Minted:{" "}
                  <span className="font-bold text-text-primary">
                    {totalMinted !== undefined && maxSupply !== undefined
                      ? `${formatCompactNumber(totalMinted)} / ${formatCompactNumber(maxSupply)}`
                      : "…"}
                  </span>
                </p>
                <p>
                  Price:{" "}
                  <span className="font-bold text-text-primary">
                    {publicPrice !== undefined
                      ? `${formatEther(publicPrice)} ETH`
                      : "…"}
                  </span>
                </p>
                <p>
                  Max / wallet:{" "}
                  <span className="font-bold text-text-primary">
                    {maxPerWallet !== undefined ? formatCompactNumber(maxPerWallet) : "…"}
                  </span>
                </p>
              </div>
              {mintProgress !== undefined ? (
                <div className="mt-2.5">
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
                    <div
                      className="h-full rounded-full bg-iris-strong transition-[width] duration-700 ease-out"
                      style={{ width: `${Math.max(mintProgress, 1)}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                Max per wallet
              </span>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={5000}
                  step={1}
                  value={maxPerWalletInput}
                  onChange={(event) => setMaxPerWalletInput(event.target.value)}
                  placeholder="1"
                  className={`${inputClass} py-2.5`}
                />
                <button
                  onClick={handleSaveMaxPerWallet}
                  disabled={
                    !canWrite ||
                    maxPerWalletTx.isPending ||
                    maxPerWalletTx.isConfirming
                  }
                  className="whitespace-nowrap rounded border border-ink/10 bg-paper px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-text-primary transition-all hover:bg-ink/[0.04] disabled:opacity-40"
                >
                  {maxPerWalletTx.isPending
                    ? "Confirm…"
                    : maxPerWalletTx.isConfirming
                      ? "Saving…"
                      : "Update"}
                </button>
              </div>
              <p className="mt-1.5 text-[10px] leading-4 text-muted-blue">
                Applies to future public mints only. Tokens already minted stay
                put; owner mints are exempt from this cap.
              </p>
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                Public price (ETH)
              </span>
              <div className="flex gap-2">
                <input
                  value={priceInput}
                  onChange={(event) => setPriceInput(event.target.value)}
                  placeholder="0.1"
                  className={`${inputClass} py-2.5`}
                />
                <button
                  onClick={handleSavePrice}
                  disabled={
                    !canWrite ||
                    priceTx.isPending ||
                    priceTx.isConfirming
                  }
                  className="whitespace-nowrap rounded border border-ink/10 bg-paper px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-text-primary transition-all hover:bg-ink/[0.04] disabled:opacity-40"
                >
                  {priceTx.isPending
                    ? "Confirm…"
                    : priceTx.isConfirming
                      ? "Saving…"
                      : "Update"}
                </button>
              </div>
              <p className="mt-1.5 text-[10px] leading-4 text-muted-blue">
                Charged per NFT during the public phase, in GIWA ETH.
              </p>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-4">
            <button
              onClick={handleResetForm}
              disabled={!contractConfigured}
              className="rounded border border-ink/10 bg-paper px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-text-primary transition-all hover:bg-ink/[0.04] disabled:opacity-40"
            >
              Reset from chain
            </button>
            {CONTRACT_ADDRESS && (
              <a
                href={`https://sepolia-explorer.giwa.io/address/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto font-mono text-[10px] text-iris hover:underline"
              >
                {CONTRACT_ADDRESS.slice(0, 6)}…{CONTRACT_ADDRESS.slice(-4)}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Owner controls */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="ui-container rounded overflow-hidden">
          <div className="border-b border-ink/10 px-6 py-4">
            <h3 className="text-xl font-header text-text-primary">
              Owner mint
            </h3>
            <p className="mt-1 text-[11px] text-muted-blue">
              Mint straight to any address for free. Exempt from the per-wallet
              cap, still bound by the 2,222 supply cap.
            </p>
          </div>
          <div className="space-y-3 p-6">
            <input
              value={mintTo}
              onChange={(event) => setMintTo(event.target.value)}
              placeholder="0x… recipient address"
              spellCheck={false}
              className={`${inputClass} font-mono`}
            />
            <div className="flex gap-2">
              <input
                value={mintQuantity}
                onChange={(event) => setMintQuantity(event.target.value)}
                inputMode="numeric"
                placeholder="1"
                className={`${inputClass} font-mono`}
              />
              <button
                onClick={handleOwnerMint}
                disabled={
                  !canWrite ||
                  ownerMintTx.isPending ||
                  ownerMintTx.isConfirming
                }
                className="whitespace-nowrap rounded-full bg-accent-warm px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-background transition-all hover:brightness-110 disabled:opacity-40"
              >
                {ownerMintTx.isPending
                  ? "Confirm in wallet…"
                  : ownerMintTx.isConfirming
                    ? "Minting…"
                    : "Mint to address"}
              </button>
            </div>
            <p className="text-[10px] leading-4 text-muted-blue">
              {totalMinted !== undefined && maxSupply !== undefined
                ? `${formatCompactNumber(totalMinted)} minted of ${formatCompactNumber(maxSupply)}.`
                : "Reading supply…"}
            </p>
          </div>
        </div>

        <div className="ui-container rounded overflow-hidden">
          <div className="border-b border-ink/10 px-6 py-4">
            <h3 className="text-xl font-header text-text-primary">Treasury</h3>
            <p className="mt-1 text-[11px] text-muted-blue">
              Sweep the ETH collected by public mints to a wallet.
            </p>
          </div>
          <div className="space-y-3 p-6">
            <div className="flex items-center justify-between rounded-lg border border-ink/10 bg-ink/[0.02] px-4 py-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                Balance
              </span>
              <span className="font-mono text-sm font-bold text-text-primary">
                {contractBalance
                  ? `${formatCompactNumber(formatEther(contractBalance.value), {
                      maximumFractionDigits: 4,
                    })} ${contractBalance.symbol}`
                  : "…"}
              </span>
            </div>
            <input
              value={withdrawTo}
              onChange={(event) => setWithdrawTo(event.target.value)}
              placeholder="0x… recipient address"
              spellCheck={false}
              className={`${inputClass} font-mono`}
            />
            <button
              onClick={handleWithdraw}
              disabled={
                !canWrite || withdrawTx.isPending || withdrawTx.isConfirming
              }
              className="rounded border border-ink/10 bg-paper px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-text-primary transition-all hover:bg-ink/[0.04] disabled:opacity-40"
            >
              {withdrawTx.isPending
                ? "Confirm in wallet…"
                : withdrawTx.isConfirming
                  ? "Sending…"
                  : "Withdraw balance"}
            </button>
            <p className="text-[10px] leading-4 text-muted-blue">
              Sends the full contract balance to the recipient.
            </p>
          </div>
        </div>
      </div>

      {/* Metadata + readout */}
      <div className="ui-container rounded overflow-hidden">
        <div className="border-b border-ink/10 px-6 py-4">
          <h3 className="text-xl font-header text-text-primary">
            Metadata & collection readout
          </h3>
          <p className="mt-1 text-[11px] text-muted-blue">
            tokenURI = base URI + token id + &quot;.json&quot;. The collection
            name, symbol and supply cap are immutable.
          </p>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={baseUriInput}
              onChange={(event) => setBaseUriInput(event.target.value)}
              placeholder="https://…/api/launchpad/metadata/"
              spellCheck={false}
              className={`${inputClass} flex-1 font-mono text-xs`}
            />
            <button
              onClick={handleSaveBaseUri}
              disabled={
                !canWrite || baseUriTx.isPending || baseUriTx.isConfirming
              }
              className="rounded border border-ink/10 bg-paper px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-text-primary transition-all hover:bg-ink/[0.04] disabled:opacity-40"
            >
              {baseUriTx.isPending
                ? "Confirm in wallet…"
                : baseUriTx.isConfirming
                  ? "Saving…"
                  : "Update base URI"}
            </button>
          </div>

          {baseUriInput.trim() && !baseUriInput.trim().endsWith("/") ? (
            <p className="text-[10px] text-orange-700 dark:text-orange-300">
              This should end with a slash, otherwise the token id is appended
              to the last path segment.
            </p>
          ) : null}

          {!derivedBaseUri && !baseUriInput.trim() ? (
            <p className="text-[10px] text-muted-blue">
              No token has been minted yet, so the contract cannot report its
              base URI. The deployed collection already points at the ARIWA
              metadata endpoint; you can overwrite it here at any time.
            </p>
          ) : null}

          <dl className="grid gap-2 text-[11px] sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-center justify-between rounded-lg border border-ink/10 bg-ink/[0.02] px-4 py-2.5">
              <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                Name
              </dt>
              <dd className="font-bold text-text-primary">
                {collectionName ?? "…"}
              </dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-ink/10 bg-ink/[0.02] px-4 py-2.5">
              <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                Symbol
              </dt>
              <dd className="font-bold text-text-primary">
                {collectionSymbol ?? "…"}
              </dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-ink/10 bg-ink/[0.02] px-4 py-2.5">
              <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                Max supply
              </dt>
              <dd className="font-bold text-text-primary">
                {maxSupply !== undefined
                  ? `${formatCompactNumber(maxSupply)} · immutable`
                  : "…"}
              </dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-ink/10 bg-ink/[0.02] px-4 py-2.5">
              <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                Max / wallet
              </dt>
              <dd className="font-bold text-text-primary">
                {maxPerWallet !== undefined ? formatCompactNumber(maxPerWallet) : "…"}
              </dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-ink/10 bg-ink/[0.02] px-4 py-2.5">
              <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                Minted
              </dt>
              <dd className="font-bold text-text-primary">
                {totalMinted !== undefined ? formatCompactNumber(totalMinted) : "…"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-ink/[0.02] px-4 py-2.5">
              <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                Owner
              </dt>
              <dd className="truncate font-mono text-[10px] text-text-primary">
                {owner ?? "…"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Holder gate */}
      <div className="ui-container rounded overflow-hidden">
        <div className="border-b border-ink/10 px-6 py-4">
          <h3 className="text-xl font-header text-text-primary">
            Holder requirement
          </h3>
          <p className="mt-1 text-[11px] text-muted-blue">
            Users must hold at least one of the enabled minimums to mint. Each
            chain keeps its own fixed native currency — only the minimum amount
            is configurable. Leave every chain off to make the mint open to
            everyone. Balances are read from each chain through the server.
          </p>
        </div>

        <div className="space-y-3 p-6">
          {HOLDER_CHAIN_KEYS.map((chain) => {
            const meta = HOLDER_CHAINS[chain];
            const row = holderState[chain];
            return (
              <div
                key={chain}
                className={`flex flex-wrap items-center gap-4 rounded-xl border p-4 transition-colors ${
                  row.enabled
                    ? "border-iris/30 bg-iris/5"
                    : "border-ink/10 bg-ink/[0.02]"
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    updateHolderRow(chain, { enabled: !row.enabled })
                  }
                  className={`flex h-6 w-11 flex-shrink-0 items-center rounded-full p-0.5 transition-colors ${
                    row.enabled ? "bg-iris-strong" : "bg-ink/15"
                  }`}
                  aria-pressed={row.enabled}
                >
                  <span
                    className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      row.enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>

                <div className="min-w-[150px]">
                  <p className="text-sm font-bold text-text-primary">
                    {meta.label}
                  </p>
                  <p className="text-[10px] text-muted-blue">
                    Chain ID {meta.id} · native {meta.symbol} (fixed)
                  </p>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-blue">
                    Min amount
                  </span>
                  <input
                    value={row.minAmount}
                    onChange={(event) =>
                      updateHolderRow(chain, { minAmount: event.target.value })
                    }
                    disabled={!row.enabled}
                    className={`${inputClass} w-28 py-2 text-right`}
                    placeholder={meta.defaultMinAmount}
                  />
                  <span className="w-8 text-xs font-bold text-muted-blue">
                    {meta.symbol}
                  </span>
                </div>
              </div>
            );
          })}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-[10px] text-muted-blue">
              {activeRequirements.length > 0
                ? `Currently active: ${activeRequirements
                    .map(
                      (requirement) =>
                        `${requirement.minAmount} ${HOLDER_CHAINS[requirement.chain].symbol} on ${HOLDER_CHAINS[requirement.chain].label}`
                    )
                    .join(" · ")}`
                : "No holder gate is active right now."}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleLoadDefaultHolderGate}
                disabled={savingHolders}
                className="rounded border border-ink/10 bg-paper px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-text-primary transition-all hover:bg-ink/[0.04] disabled:opacity-40"
              >
                Load defaults
              </button>
              <button
                onClick={handleSaveHolderGate}
                disabled={savingHolders}
                className="rounded-full bg-accent-warm px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-background transition-all hover:brightness-110 disabled:opacity-40"
              >
                {savingHolders ? "Saving…" : "Save holder gate"}
              </button>
            </div>
          </div>

          {holderConfigError && (
            <p className="text-xs text-red-600 dark:text-red-300">{holderConfigError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
