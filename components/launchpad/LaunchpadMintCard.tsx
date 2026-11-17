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
import type { Hash } from "viem";
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

export function LaunchpadMintCard({
  configured,
  values,
  status,
  currency,
  contractAddress,
  onMinted,
  onRetryContract,
}: {
  configured: boolean;
  values?: MintValues;
  status: DropStatus;
  currency: PaymentCurrency;
  contractAddress?: `0x${string}`;
  onMinted?: (quantity: number) => void;
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
  const [hash, setHash] = useState<Hash>();
  const [confirmed, setConfirmed] = useState<{
    hash: Hash;
    quantity: number;
  } | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(
    null,
  );
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);

  const lastQuantity = useRef(1);
  const closeSuccess = useCallback(() => setSuccessOpen(false), []);

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
  const maxQuantity = Number(remainingCap < 20n ? remainingCap : 20n);

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

    setQuantity(1);
    setConfirmed({ hash, quantity: mintedQuantity });
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
    onMinted?.(mintedQuantity);
  }, [
    address,
    erc20Payment,
    hash,
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
    if (quantity < 1 || quantity > maxQuantity) {
      toast.error("Choose a valid quantity");
      return;
    }
    if (insufficientBalance) {
      toast.error(`Not enough ${currency.symbol}`, {
        description: `Buy ${currency.symbol} in the pool, then come back to mint.`,
      });
      return;
    }

    setBusy(true);
    setHash(undefined);
    setConfirmed(null);
    setSuccessOpen(false);
    lastQuantity.current = quantity;

    try {
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
        args: [BigInt(quantity)],
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

  const statusDetail =
    status.tone === "live" && values
      ? `${formatCount(remainingBySupply)} of ${formatCount(supply)} pieces remain. First come, first served.`
      : values && !values.publicMintOpen
        ? "The owner has not opened the public mint yet. Follow the Hollow for the announcement."
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
        checkingEligibility={checkingEligibility}
        eligibilityError={eligibilityError}
        onRetryEligibility={() => void checkEligibility()}
        statusDetail={statusDetail}
        contractAddress={contractAddress}
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
