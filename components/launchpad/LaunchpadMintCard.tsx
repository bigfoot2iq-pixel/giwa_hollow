"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  parseEventLogs,
  zeroAddress,
  type Hash,
  type Log,
  type PublicClient,
} from "viem";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Coins,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { AriwaNFTABI, giwaSepolia } from "@/lib/contracts";
import type { MintPermit } from "@/lib/launchpad/mint-permit";
import { LaunchpadMintActions, type MintAction } from "./LaunchpadMintActions";
import { LaunchpadMintDetails } from "./LaunchpadMintDetails";
import { LaunchpadMintSuccess } from "./LaunchpadMintSuccess";
import {
  ERC20_PAYMENT_ABI,
  formatCount,
  formatCurrency,
  isErc20Payment,
  type DropStatus,
  type EligibilityResponse,
  type MintValues,
  type PaymentCurrency,
} from "./launchpad-format";

function shortError(error: unknown): string {
  if (error instanceof Error) {
    const withShort = error as Error & { shortMessage?: string };
    return (withShort.shortMessage || error.message).split("\n")[0];
  }
  return "The transaction could not be submitted.";
}

const PERMIT_RETRY_DELAYS_MS = [350, 900];

/**
 * Read the token id the minter actually received from the mint receipt.
 *
 * A mined transaction does not "return" the minted id to the caller: the write
 * call only yields a hash. ERC721A publishes the id in the standard `Transfer`
 * event from the zero address, and the receipt we already wait for contains
 * exactly that log. Decoding it locally costs no extra RPC request and is the
 * only exact source — `totalMinted + 1` is a guess that breaks when two
 * wallets mint around the same time.
 *
 * The log must come from this collection, belong to this transaction, start at
 * the zero address, and land in the connected wallet. Logs from other
 * contracts in the transaction (for example the ERC20 payment) are ignored.
 */
function findMintedTokenId({
  logs,
  contractAddress,
  wallet,
  transactionHash,
}: {
  logs?: readonly Log[];
  contractAddress?: `0x${string}`;
  wallet?: `0x${string}`;
  transactionHash?: Hash;
}): bigint | undefined {
  if (
    !logs ||
    logs.length === 0 ||
    !contractAddress ||
    !wallet ||
    !transactionHash
  ) {
    return undefined;
  }

  const transfers = parseEventLogs({
    abi: AriwaNFTABI,
    eventName: "Transfer",
    logs: logs.filter(
      (log) =>
        log.address.toLowerCase() === contractAddress.toLowerCase() &&
        log.transactionHash?.toLowerCase() === transactionHash.toLowerCase(),
    ),
  });

  const mint = transfers.find(
    (log) =>
      log.args.from === zeroAddress &&
      log.args.to?.toLowerCase() === wallet.toLowerCase(),
  );

  return mint?.args.tokenId;
}

/**
 * Fallback for an RPC that returns a receipt without logs: read the mint
 * events in the receipt's own block, scoped to this collection, this wallet,
 * and this transaction. It can only return a piece minted to this wallet.
 */
async function findMintedTokenIdInBlock({
  publicClient,
  contractAddress,
  wallet,
  transactionHash,
  blockNumber,
}: {
  publicClient?: PublicClient;
  contractAddress?: `0x${string}`;
  wallet?: `0x${string}`;
  transactionHash?: Hash;
  blockNumber?: bigint;
}): Promise<bigint | undefined> {
  if (
    !publicClient ||
    !contractAddress ||
    !wallet ||
    !transactionHash ||
    blockNumber === undefined
  ) {
    return undefined;
  }

  try {
    const mints = await publicClient.getContractEvents({
      address: contractAddress,
      abi: AriwaNFTABI,
      eventName: "Transfer",
      args: { from: zeroAddress, to: wallet },
      fromBlock: blockNumber,
      toBlock: blockNumber,
    });

    return mints.find(
      (event) =>
        event.transactionHash?.toLowerCase() === transactionHash.toLowerCase(),
    )?.args.tokenId;
  } catch (error) {
    console.error(
      "Could not locate the minted token id in its block:",
      error,
    );
    return undefined;
  }
}

type PermitFetchResult =
  | { ok: true; permit: MintPermit }
  | { ok: false; alreadyMinted: boolean; error: string };

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Ask the server for this wallet's mint permit.
 *
 * The route reads an RPC and signs locally, so a single transient upstream
 * hiccup should not make the visitor click "Mint" again. 5xx/network failures
 * are retried twice before the panel shows an error; an already-minted answer
 * is final.
 */
async function requestMintPermit(
  address: `0x${string}`,
): Promise<PermitFetchResult> {
  let lastError = "Could not verify your mint.";

  for (let attempt = 0; attempt <= PERMIT_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch("/api/launchpad/mint-permit", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address }),
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | (MintPermit & { error?: string; code?: string })
        | null;

      if (response.ok && payload) {
        return { ok: true, permit: payload };
      }

      if (payload?.code === "already_minted") {
        return {
          ok: false,
          alreadyMinted: true,
          error: payload.error || "You have already minted.",
        };
      }

      lastError = payload?.error || "Could not verify your mint.";
      if (response.status < 500 || attempt >= PERMIT_RETRY_DELAYS_MS.length) {
        return { ok: false, alreadyMinted: false, error: lastError };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
      if (attempt >= PERMIT_RETRY_DELAYS_MS.length) {
        return { ok: false, alreadyMinted: false, error: lastError };
      }
    }

    await wait(PERMIT_RETRY_DELAYS_MS[attempt]);
  }

  return { ok: false, alreadyMinted: false, error: lastError };
}

export function LaunchpadMintCard({
  configured,
  values,
  status,
  currency,
  contractAddress,
  ipMinted = false,
  onMinted,
  onRetryContract,
}: {
  configured: boolean;
  values?: MintValues;
  status: DropStatus;
  currency: PaymentCurrency;
  contractAddress?: `0x${string}`;
  ipMinted?: boolean;
  onMinted?: (quantity: number, mintedAtSubmit: bigint) => void;
  onRetryContract?: () => void;
}) {
  const { address, isConnected, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: giwaSepolia.id });
  const router = useRouter();

  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  // The server render tells us whether this user already minted. Keep it in
  // state so a permit rejection or a confirmed mint can lock the panel without
  // a full reload. A prop can only turn this on, never off, so OR-ing it with
  // the local flag avoids a state-sync effect.
  const [ipBlocked, setIpBlocked] = useState(false);
  const [hash, setHash] = useState<Hash>();
  const [confirmed, setConfirmed] = useState<{
    hash: Hash;
    quantity: number;
    tokenId?: bigint;
  } | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(
    null,
  );
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);

  const lastQuantity = useRef(1);
  // Capture the supply this minter saw when they submitted. The success
  // callback uses it as the base for the optimistic counter, so a live poll
  // that lands first cannot make the floor double-count the new NFT.
  const mintedAtSubmit = useRef(0n);
  const closeSuccess = useCallback(() => setSuccessOpen(false), []);

  const networkBlocked = ipBlocked || ipMinted;

  const { data: walletMintedData, refetch: refetchWalletMinted } = useReadContract({
    address: contractAddress,
    chainId: giwaSepolia.id,
    abi: AriwaNFTABI,
    functionName: "minted",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(contractAddress && address) },
  });

  const walletMinted = (walletMintedData as bigint | undefined) ?? 0n;

  // The collection charges in ARIWA by default, but the owner can switch the
  // payment asset back to native ETH on-chain. Read the minter's balance in the
  // configured asset so the UI can send them to the pool before they sign a
  // transaction the contract would reject.
  const erc20Payment = isErc20Payment(currency);

  const paymentBalanceQuery = useReadContract({
    address: erc20Payment ? currency.token : undefined,
    chainId: giwaSepolia.id,
    abi: ERC20_PAYMENT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: erc20Payment && Boolean(address) },
  });

  const nativeBalanceQuery = useBalance({
    address,
    chainId: giwaSepolia.id,
    query: { enabled: !erc20Payment && Boolean(address) },
  });

  const paymentBalance = erc20Payment
    ? (paymentBalanceQuery.data as bigint | undefined)
    : nativeBalanceQuery.data?.value;

  const paymentBalanceError = erc20Payment
    ? paymentBalanceQuery.isError
    : nativeBalanceQuery.isError;

  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    address: erc20Payment ? currency.token : undefined,
    chainId: giwaSepolia.id,
    abi: ERC20_PAYMENT_ABI,
    functionName: "allowance",
    args: address && contractAddress ? [address, contractAddress] : undefined,
    query: { enabled: erc20Payment && Boolean(address && contractAddress) },
  });

  const allowance = allowanceData as bigint | undefined;

  const refetchTokenBalance = paymentBalanceQuery.refetch;
  const refetchNativeBalance = nativeBalanceQuery.refetch;

  const refetchPaymentBalance = useCallback(() => {
    if (erc20Payment) {
      void refetchTokenBalance();
    } else {
      void refetchNativeBalance();
    }
  }, [erc20Payment, refetchNativeBalance, refetchTokenBalance]);

  // Mirror the supply floor above for the wallet counter: a confirmed mint can
  // land before the chain read catches up, so keep the new total visible until
  // `minted` reports it too. The floor is scoped to the wallet that minted,
  // so switching accounts never shows another wallet's count.
  const [walletMintedFloor, setWalletMintedFloor] = useState<{
    address: `0x${string}`;
    value: bigint;
  } | null>(null);

  useEffect(() => {
    if (
      walletMintedFloor &&
      walletMintedFloor.address === address &&
      walletMinted >= walletMintedFloor.value
    ) {
      setWalletMintedFloor(null);
    }
  }, [address, walletMinted, walletMintedFloor]);

  const displayWalletMinted =
    walletMintedFloor &&
    walletMintedFloor.address === address &&
    walletMintedFloor.value > walletMinted
      ? walletMintedFloor.value
      : walletMinted;

  const receipt = useWaitForTransactionReceipt({
    hash,
    query: { enabled: Boolean(hash) },
  });

  const price = values?.price ?? 0n;
  const supply = values?.supply ?? 0n;
  const walletLimit = values?.walletLimit ?? 0n;
  const minted = values?.minted ?? 0n;
  const publicMintOpen = values?.publicMintOpen ?? false;

  const soldOut = supply > 0n && minted >= supply;
  const walletLimitReached =
    Boolean(address) && walletLimit > 0n && displayWalletMinted >= walletLimit;

  const remainingBySupply = supply > minted ? supply - minted : 0n;
  const remainingByWallet =
    walletLimit > displayWalletMinted ? walletLimit - displayWalletMinted : 0n;
  const remainingCap =
    remainingBySupply < remainingByWallet
      ? remainingBySupply
      : remainingByWallet;
  // The collection's permit gate is one NFT per user, so a transaction can
  // never batch several pieces even when the supply and wallet caps allow it.
  const maxQuantity = remainingCap > 0n ? 1 : 0;

  const gateEnabled = eligibility?.gateEnabled === true;
  const holderEligible = eligibility?.eligible === true;
  const eligibilityReady = Boolean(eligibility || eligibilityError);
  const gateBlocksMint =
    isConnected &&
    (!eligibilityReady ||
      Boolean(eligibilityError) ||
      (gateEnabled && !holderEligible));

  const isLive =
    configured &&
    Boolean(values) &&
    publicMintOpen &&
    !soldOut &&
    !networkBlocked &&
    !gateBlocksMint &&
    maxQuantity > 0;

  const totalCost = price * BigInt(Math.max(quantity, 0));

  const balanceKnown = paymentBalance !== undefined || paymentBalanceError;
  const insufficientBalance =
    Boolean(address) &&
    paymentBalance !== undefined &&
    paymentBalance < totalCost;
  const needsApproval =
    erc20Payment &&
    allowance !== undefined &&
    totalCost > 0n &&
    allowance < totalCost;

  const checkEligibility = useCallback(async () => {
    if (!address) {
      setEligibility(null);
      setEligibilityError(null);
      setCheckingEligibility(false);
      return;
    }

    setCheckingEligibility(true);
    setEligibility(null);
    setEligibilityError(null);

    try {
      const response = await fetch(
        `/api/launchpad/eligibility?address=${address}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not check holder access");
      }

      setEligibility(data as EligibilityResponse);
    } catch (error) {
      setEligibility(null);
      setEligibilityError(
        error instanceof Error ? error.message : "Holder balance check failed",
      );
    } finally {
      setCheckingEligibility(false);
    }
  }, [address]);

  useEffect(() => {
    void checkEligibility();
  }, [checkEligibility]);

  useEffect(() => {
    if (maxQuantity > 0 && quantity > maxQuantity) {
      setQuantity(maxQuantity);
    }
    if (maxQuantity === 0 && quantity !== 1) {
      setQuantity(1);
    }
  }, [maxQuantity, quantity]);

  const handledSuccess = useRef<Hash | undefined>(undefined);
  const handledError = useRef<Hash | undefined>(undefined);

  useEffect(() => {
    if (!hash || !receipt.isSuccess || handledSuccess.current === hash) return;

    handledSuccess.current = hash;
    const mintedQuantity = lastQuantity.current;
    const mintedTokenId = findMintedTokenId({
      logs: receipt.data?.logs,
      contractAddress,
      wallet: address,
      transactionHash: hash,
    });

    setQuantity(1);
    setIpBlocked(true);
    setConfirmed({ hash, quantity: mintedQuantity, tokenId: mintedTokenId });

    // Some RPCs return a receipt without logs. Ask for this wallet's mint in
    // the receipt's block instead of guessing the next sequential id, which
    // could belong to another wallet that minted first. The success card
    // shows a neutral tile until this resolves.
    if (mintedTokenId === undefined) {
      void findMintedTokenIdInBlock({
        publicClient,
        contractAddress,
        wallet: address,
        transactionHash: hash,
        blockNumber: receipt.data?.blockNumber,
      }).then((resolvedTokenId) => {
        if (resolvedTokenId === undefined) return;
        setConfirmed((current) =>
          current && current.hash === hash
            ? { ...current, tokenId: resolvedTokenId }
            : current,
        );
      });
    }
    if (address) {
      setWalletMintedFloor((current) => {
        const base =
          current && current.address === address && current.value > walletMinted
            ? current.value
            : walletMinted;
        return {
          address,
          value: base + BigInt(mintedQuantity),
        };
      });
    }
    setSuccessOpen(true);
    toast.success(
      `${mintedQuantity} ${mintedQuantity === 1 ? "NFT" : "NFTs"} minted`,
      {
        id: hash,
        description: `Confirmed on ${giwaSepolia.name}.`,
      },
    );
    void refetchWalletMinted();
    refetchPaymentBalance();
    if (erc20Payment) void refetchAllowance();
    onMinted?.(mintedQuantity, mintedAtSubmit.current);
  }, [
    address,
    contractAddress,
    erc20Payment,
    hash,
    publicClient,
    receipt.data,
    receipt.isSuccess,
    refetchAllowance,
    refetchPaymentBalance,
    refetchWalletMinted,
    onMinted,
    walletMinted,
  ]);

  useEffect(() => {
    if (
      !hash ||
      !receipt.isError ||
      !receipt.error ||
      handledError.current === hash
    ) {
      return;
    }

    handledError.current = hash;
    toast.error("Mint failed", {
      id: hash,
      description: shortError(receipt.error),
    });
  }, [hash, receipt.isError, receipt.error]);

  async function submitMint() {
    if (!contractAddress || !address || !values) return;
    if (quantity !== 1 || maxQuantity < 1) {
      toast.error("One NFT per user");
      return;
    }
    if (insufficientBalance) {
      toast.error(`Not enough ${currency.symbol}`, {
        description: `Buy ${currency.symbol} in the pool, then come back to mint.`,
      });
      return;
    }

    mintedAtSubmit.current = values.minted;
    setBusy(true);
    setHash(undefined);
    setConfirmed(null);
    setSuccessOpen(false);
    lastQuantity.current = quantity;

    try {
      // The collection only accepts a mint with a server-signed permit.
      // Fetch it before asking the wallet for anything so an already-minted
      // user never has to approve ARIWA first. Transient failures retry here.
      const permitResult = await requestMintPermit(address);

      if (!permitResult.ok) {
        if (permitResult.alreadyMinted) {
          setIpBlocked(true);
          toast.error("You already minted", {
            description:
              "One NFT per user. Switching wallets won't unlock another mint.",
          });
          return;
        }

        throw new Error(permitResult.error);
      }

      const { ipHash, signature } = permitResult.permit;
      let paymentValue = 0n;

      if (erc20Payment) {
        // Refresh first: the wallet may have approved the collection already.
        const { data: freshAllowance } = await refetchAllowance();
        const currentAllowance =
          (freshAllowance as bigint | undefined) ?? allowance ?? 0n;

        if (currentAllowance < totalCost) {
          if (!publicClient) throw new Error("GIWA client unavailable");

          const approveHash = await writeContractAsync({
            address: currency.token,
            chainId: giwaSepolia.id,
            abi: ERC20_PAYMENT_ABI,
            functionName: "approve",
            args: [contractAddress, totalCost],
          });

          toast.loading(`Approving ${currency.symbol}`, {
            id: approveHash,
            description: "Confirm the approval in your wallet. The mint follows automatically.",
          });

          const approveReceipt = await publicClient.waitForTransactionReceipt({
            hash: approveHash,
          });
          if (approveReceipt.status !== "success") {
            toast.error(`${currency.symbol} approval failed`, {
              id: approveHash,
            });
            throw new Error(`${currency.symbol} approval reverted`);
          }

          toast.success(`${currency.symbol} approved`, {
            id: approveHash,
            description: "Submitting the mint…",
          });

          await refetchAllowance();
        }
      } else {
        paymentValue = totalCost;
      }

      const txHash = await writeContractAsync({
        address: contractAddress,
        chainId: giwaSepolia.id,
        abi: AriwaNFTABI,
        functionName: "publicMint",
        args: [1n, ipHash, signature],
        value: paymentValue,
      });

      setHash(txHash);
      toast.loading("Mint submitted", {
        id: txHash,
        description: "Waiting for GIWA to confirm the transaction…",
      });
    } catch (error) {
      const message = shortError(error);
      if (!/user rejected|user denied/i.test(message)) {
        toast.error("Mint could not be submitted", { description: message });
      }
    } finally {
      setBusy(false);
    }
  }

  const handleQuantity = (delta: number) => {
    setQuantity((current) =>
      Math.min(Math.max(current + delta, 1), Math.max(maxQuantity, 1)),
    );
  };

  const action = getPrimaryAction({
    configured,
    status,
    values,
    soldOut,
    isClosed: Boolean(values) && !publicMintOpen,
    ipBlocked: networkBlocked,
    isConnected,
    alsoWrongChain: isConnected && chainId !== giwaSepolia.id,
    isSwitching,
    walletLimitReached,
    checkingEligibility,
    eligibilityReady,
    eligibilityError: Boolean(eligibilityError),
    gateEnabled,
    holderEligible,
    busy,
    confirming: receipt.isLoading,
    isLive,
    quantity,
    totalCost,
    currency,
    balanceKnown,
    insufficientBalance,
    needsApproval,
    onConnect: () => openConnectModal?.(),
    onSwitch: () => switchChain({ chainId: giwaSepolia.id }),
    onRetryEligibility: () => void checkEligibility(),
    onRetryContract,
    onBuyAriwa: () => router.push("/trade"),
    onMint: () => void submitMint(),
  });

  const totalLabel = values === undefined ? "—" : formatCurrency(totalCost, currency);

  const statusDetail = networkBlocked
    ? "You've already minted your piece. One NFT per user — switching wallets won't unlock another mint."
    : status.tone === "live" && values
      ? `${formatCount(remainingBySupply)} of ${formatCount(supply)} pieces remain. First come, first served.`
      : values && !values.publicMintOpen
        ? "The owner has not opened the public mint yet. Follow ARIWA for the announcement."
        : status.detail;

  return (
    <div className="flex flex-col gap-3.5">
      <LaunchpadMintDetails
        status={status}
        values={values}
        address={address}
        configured={configured}
        price={price}
        currency={currency}
        paymentBalance={paymentBalance}
        paymentBalanceError={paymentBalanceError}
        totalCost={totalCost}
        walletLimit={walletLimit}
        maxQuantity={maxQuantity}
        quantity={quantity}
        busy={busy}
        confirming={receipt.isLoading}
        onQuantity={handleQuantity}
        totalLabel={totalLabel}
        eligibility={eligibility}
        eligibilityError={eligibilityError}
        onRetryEligibility={() => void checkEligibility()}
        statusDetail={statusDetail}
        contractAddress={contractAddress}
        ipBlocked={networkBlocked}
      />

      <LaunchpadMintActions
        action={action}
        values={values}
        walletMinted={displayWalletMinted}
        connected={Boolean(address)}
      />

      <LaunchpadMintSuccess
        open={successOpen}
        onClose={closeSuccess}
        hash={confirmed?.hash}
        quantity={confirmed?.quantity ?? 1}
        tokenId={confirmed?.tokenId}
      />
    </div>
  );
}

function getPrimaryAction({
  configured,
  status,
  values,
  soldOut,
  isClosed,
  ipBlocked,
  isConnected,
  alsoWrongChain,
  isSwitching,
  walletLimitReached,
  checkingEligibility,
  eligibilityReady,
  eligibilityError,
  gateEnabled,
  holderEligible,
  busy,
  confirming,
  isLive,
  quantity,
  totalCost,
  currency,
  balanceKnown,
  insufficientBalance,
  needsApproval,
  onConnect,
  onSwitch,
  onRetryEligibility,
  onRetryContract,
  onBuyAriwa,
  onMint,
}: {
  configured: boolean;
  status: DropStatus;
  values?: MintValues;
  soldOut: boolean;
  isClosed: boolean;
  ipBlocked: boolean;
  isConnected: boolean;
  alsoWrongChain: boolean;
  isSwitching: boolean;
  walletLimitReached: boolean;
  checkingEligibility: boolean;
  eligibilityReady: boolean;
  eligibilityError: boolean;
  gateEnabled: boolean;
  holderEligible: boolean;
  busy: boolean;
  confirming: boolean;
  isLive: boolean;
  quantity: number;
  totalCost: bigint;
  currency: PaymentCurrency;
  balanceKnown: boolean;
  insufficientBalance: boolean;
  needsApproval: boolean;
  onConnect: () => void;
  onSwitch: () => void;
  onRetryEligibility: () => void;
  onRetryContract?: () => void;
  onBuyAriwa: () => void;
  onMint: () => void;
}): MintAction {
  if (!configured) {
    return {
      label: "Launchpad not configured",
      disabled: true,
      icon: <Sparkles className="size-4" />,
      onClick: onConnect,
    };
  }

  if (status.tone === "error") {
    return {
      label: "Retry contract read",
      disabled: !onRetryContract,
      icon: <RefreshCw className="size-4" />,
      onClick: () => onRetryContract?.(),
    };
  }

  if (!values) {
    return {
      label: "Reading contract…",
      disabled: true,
      icon: <Loader2 className="size-4 animate-spin" />,
      onClick: onConnect,
    };
  }

  if (soldOut) {
    return {
      label: "Sold out",
      disabled: true,
      icon: <Check className="size-4" />,
      onClick: onConnect,
    };
  }

  if (isClosed) {
    return {
      label: "Public mint closed",
      disabled: true,
      icon: <AlertTriangle className="size-4" />,
      onClick: onConnect,
    };
  }

  if (ipBlocked) {
    return {
      label: "Already minted",
      disabled: true,
      icon: <ShieldCheck className="size-4" />,
      onClick: onConnect,
    };
  }

  if (!isConnected) {
    return {
      label: "Connect wallet",
      disabled: false,
      icon: <Wallet className="size-4" />,
      onClick: onConnect,
    };
  }

  if (alsoWrongChain) {
    return {
      label: isSwitching ? "Switching…" : "Switch to GIWA",
      disabled: isSwitching,
      icon: isSwitching ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Wallet className="size-4" />
      ),
      onClick: onSwitch,
    };
  }

  if (eligibilityError) {
    return {
      label: "Retry holder check",
      disabled: false,
      icon: <RefreshCw className="size-4" />,
      onClick: onRetryEligibility,
    };
  }

  if (checkingEligibility || !eligibilityReady) {
    return {
      label: "Checking holder access…",
      disabled: true,
      icon: <Loader2 className="size-4 animate-spin" />,
      onClick: onRetryEligibility,
    };
  }

  if (gateEnabled && !holderEligible) {
    return {
      label: "Holder balance required",
      disabled: true,
      icon: <ShieldCheck className="size-4" />,
      onClick: onRetryEligibility,
    };
  }

  if (walletLimitReached) {
    return {
      label: "Wallet limit reached",
      disabled: true,
      icon: <Check className="size-4" />,
      onClick: onConnect,
    };
  }

  if (busy) {
    return {
      label: "Confirm in wallet…",
      disabled: true,
      icon: <Loader2 className="size-4 animate-spin" />,
      onClick: onConnect,
    };
  }

  if (confirming) {
    return {
      label: "Minting on GIWA…",
      disabled: true,
      icon: <Loader2 className="size-4 animate-spin" />,
      onClick: onConnect,
    };
  }

  // Balance checks come after the transient states so a confirmation is never
  // replaced by a stale "buy" prompt.
  if (!balanceKnown) {
    return {
      label: `Checking ${currency.symbol} balance…`,
      disabled: true,
      icon: <Loader2 className="size-4 animate-spin" />,
      onClick: onConnect,
    };
  }

  if (insufficientBalance) {
    if (currency.isNative) {
      return {
        label: "Not enough ETH for mint + gas",
        disabled: true,
        icon: <Wallet className="size-4" />,
        onClick: onConnect,
      };
    }

    return {
      label: `Buy ${currency.symbol} to mint`,
      disabled: false,
      icon: <Coins className="size-4" />,
      onClick: onBuyAriwa,
    };
  }

  if (isLive) {
    const amount = formatCurrency(totalCost, currency);
    return {
      label: needsApproval
        ? `Approve & mint ${quantity} · ${amount}`
        : `Mint ${quantity} · ${amount}`,
      disabled: false,
      icon: <Plus className="size-4" />,
      onClick: onMint,
    };
  }

  return {
    label: "Mint unavailable",
    disabled: true,
    icon: <AlertTriangle className="size-4" />,
    onClick: onConnect,
  };
}
