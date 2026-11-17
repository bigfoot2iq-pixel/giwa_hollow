"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { isAddress, zeroAddress } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import { AriwaNFTABI, giwaSepolia, LAUNCHPAD_NFT_ADDRESS } from "@/lib/contracts";
import { LaunchpadCta } from "./LaunchpadCta";
import { LaunchpadFaq } from "./LaunchpadFaq";
import { LaunchpadMintCard } from "./LaunchpadMintCard";
import { LaunchpadPreview } from "./LaunchpadPreview";
import { LaunchpadSummary } from "./LaunchpadSummary";
import {
  ERC20_PAYMENT_ABI,
  NATIVE_CURRENCY,
  getDropStatus,
  type MintValues,
  type PaymentCurrency,
} from "./launchpad-format";

const LAUNCHPAD_ADDRESS =
  LAUNCHPAD_NFT_ADDRESS && isAddress(LAUNCHPAD_NFT_ADDRESS)
    ? LAUNCHPAD_NFT_ADDRESS
    : undefined;

const subscribeToHydration = () => () => {};
const clientHydrationSnapshot = () => true;
const serverHydrationSnapshot = () => false;

/**
 * The launchpad's public shell. It owns the collection reads and the optimistic
 * supply floor, then hands the same values to the summary and the mint panel so
 * both surfaces always agree.
 */
export function LaunchpadMint() {
  const configured = Boolean(LAUNCHPAD_ADDRESS);

  // React Query can hold launchpad data in its client cache, so the server and
  // the first client render must both start from the neutral state. This flag
  // flips only after hydration, which keeps the markup in sync.
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    clientHydrationSnapshot,
    serverHydrationSnapshot,
  );

  const {
    data: mintConfig,
    isError,
    refetch,
  } = useReadContracts({
    contracts: [
      {
        address: LAUNCHPAD_ADDRESS,
        chainId: giwaSepolia.id,
        abi: AriwaNFTABI,
        functionName: "publicPrice",
      },
      {
        address: LAUNCHPAD_ADDRESS,
        chainId: giwaSepolia.id,
        abi: AriwaNFTABI,
        functionName: "maxSupply",
      },
      {
        address: LAUNCHPAD_ADDRESS,
        chainId: giwaSepolia.id,
        abi: AriwaNFTABI,
        functionName: "maxPerWallet",
      },
      {
        address: LAUNCHPAD_ADDRESS,
        chainId: giwaSepolia.id,
        abi: AriwaNFTABI,
        functionName: "totalMinted",
      },
      {
        address: LAUNCHPAD_ADDRESS,
        chainId: giwaSepolia.id,
        abi: AriwaNFTABI,
        functionName: "publicMintOpen",
      },
      {
        address: LAUNCHPAD_ADDRESS,
        chainId: giwaSepolia.id,
        abi: AriwaNFTABI,
        functionName: "paymentToken",
      },
    ],
    query: { enabled: configured },
  });

  const { data: collectionName } = useReadContract({
    address: LAUNCHPAD_ADDRESS,
    chainId: giwaSepolia.id,
    abi: AriwaNFTABI,
    functionName: "name",
    query: { enabled: configured },
  });

  const { data: collectionSymbol } = useReadContract({
    address: LAUNCHPAD_ADDRESS,
    chainId: giwaSepolia.id,
    abi: AriwaNFTABI,
    functionName: "symbol",
    query: { enabled: configured },
  });

  const values = useMemo<MintValues | undefined>(() => {
    if (!mintConfig) return undefined;

    const [price, supply, walletLimit, minted, publicMintOpen, paymentToken] =
      mintConfig;
    if (
      price.status !== "success" ||
      supply.status !== "success" ||
      walletLimit.status !== "success" ||
      minted.status !== "success" ||
      publicMintOpen.status !== "success"
    ) {
      return undefined;
    }

    return {
      price: price.result,
      supply: supply.result,
      walletLimit: walletLimit.result,
      minted: minted.result,
      publicMintOpen: publicMintOpen.result,
      // Older deployments do not expose `paymentToken`; those collections
      // charge native ETH, so fall back to the zero address.
      paymentToken:
        paymentToken.status === "success" ? paymentToken.result : zeroAddress,
    };
  }, [mintConfig]);

  // Resolve the asset the collection charges in. A zero address means the
  // owner kept native ETH; otherwise read the token's own symbol and decimals
  // so the price is never mislabelled.
  const paymentTokenAddress = values?.paymentToken;
  const erc20Payment = Boolean(
    paymentTokenAddress && paymentTokenAddress !== zeroAddress,
  );

  const { data: paymentSymbol } = useReadContract({
    address: erc20Payment ? paymentTokenAddress : undefined,
    chainId: giwaSepolia.id,
    abi: ERC20_PAYMENT_ABI,
    functionName: "symbol",
    query: { enabled: erc20Payment },
  });

  const { data: paymentDecimals } = useReadContract({
    address: erc20Payment ? paymentTokenAddress : undefined,
    chainId: giwaSepolia.id,
    abi: ERC20_PAYMENT_ABI,
    functionName: "decimals",
    query: { enabled: erc20Payment },
  });

  const currency = useMemo<PaymentCurrency>(() => {
    if (!paymentTokenAddress || paymentTokenAddress === zeroAddress) {
      return NATIVE_CURRENCY;
    }

    return {
      token: paymentTokenAddress,
      symbol:
        typeof paymentSymbol === "string" && paymentSymbol.trim()
          ? paymentSymbol.trim()
          : "ARIWA",
      decimals:
        typeof paymentDecimals === "number" ? paymentDecimals : 18,
      isNative: false,
    };
  }, [paymentTokenAddress, paymentSymbol, paymentDecimals]);

  // The RPC can lag a confirmed mint by a few seconds. Keep the new supply as a
  // floor so the counters move immediately, then drop the floor once the chain
  // reports the same total.
  const [mintedFloor, setMintedFloor] = useState<bigint | null>(null);

  useEffect(() => {
    if (mintedFloor !== null && values && values.minted >= mintedFloor) {
      setMintedFloor(null);
    }
  }, [mintedFloor, values]);

  const displayMinted =
    values && mintedFloor !== null && mintedFloor > values.minted
      ? mintedFloor
      : values?.minted;

  const displayValues = useMemo<MintValues | undefined>(() => {
    if (!values || displayMinted === undefined) return values;
    if (displayMinted === values.minted) return values;
    return { ...values, minted: displayMinted };
  }, [values, displayMinted]);

  const handleMinted = useCallback(
    (quantity: number) => {
      setMintedFloor((current) => {
        const base =
          current !== null && values && current > values.minted
            ? current
            : (values?.minted ?? 0n);
        return base + BigInt(quantity);
      });
      void refetch();
    },
    [refetch, values],
  );

  const liveValues = hydrated ? displayValues : undefined;
  const status = getDropStatus(liveValues, {
    configured,
    error: hydrated && isError,
  });

  const displayName =
    hydrated && typeof collectionName === "string" && collectionName.trim()
      ? collectionName
      : "ARIWA Genesis";
  const displaySymbol =
    hydrated && typeof collectionSymbol === "string" && collectionSymbol.trim()
      ? collectionSymbol
      : "ARIGEN";

  return (
    <>
      <LaunchpadSummary
        collectionName={displayName}
        symbol={displaySymbol}
        status={status}
        values={liveValues}
        displayMinted={liveValues?.minted}
        contractAddress={LAUNCHPAD_ADDRESS}
        configured={configured}
        currency={currency}
      />

      <section className="section-shell pt-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-5">
          <LaunchpadPreview />
          <LaunchpadMintCard
            configured={configured}
            values={liveValues}
            status={status}
            currency={currency}
            contractAddress={LAUNCHPAD_ADDRESS}
            onMinted={handleMinted}
            onRetryContract={() => void refetch()}
          />
        </div>
      </section>

      <LaunchpadFaq values={liveValues} symbol={displaySymbol} currency={currency} />
      <LaunchpadCta />
    </>
  );
}
