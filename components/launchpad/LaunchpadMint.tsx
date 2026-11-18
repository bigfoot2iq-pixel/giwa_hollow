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

// The public supply is the only launchpad value that changes while a visitor
// sits on the page. One eth_call every five seconds keeps the top progress bar
// live without re-reading the whole config batch; React Query pauses the
// interval in background tabs.
const LIVE_MINT_REFRESH_MS = 5_000;

const subscribeToHydration = () => () => {};
const clientHydrationSnapshot = () => true;
const serverHydrationSnapshot = () => false;

/**
 * The launchpad's public shell. It owns the collection reads and the optimistic
 * supply floor, then hands the same values to the summary and the mint panel so
 * both surfaces always agree.
 *
 * `ipMinted` comes from the server render: if this user already handled their
 * mint, the panel starts locked instead of flashing a live button.
 */
export function LaunchpadMint({ ipMinted = false }: { ipMinted?: boolean }) {
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

  const configValues = useMemo(() => {
    if (!mintConfig) return undefined;

    const [price, supply, walletLimit, publicMintOpen, paymentToken] =
      mintConfig;
    if (
      price.status !== "success" ||
      supply.status !== "success" ||
      walletLimit.status !== "success" ||
      publicMintOpen.status !== "success"
    ) {
      return undefined;
    }

    return {
      price: price.result,
      supply: supply.result,
      walletLimit: walletLimit.result,
      publicMintOpen: publicMintOpen.result,
      // Older deployments do not expose `paymentToken`; those collections
      // charge native ETH, so fall back to the zero address.
      paymentToken:
        paymentToken.status === "success" ? paymentToken.result : zeroAddress,
    };
  }, [mintConfig]);

  // Poll the minted total on its own cadence. Keeping it out of the batch
  // above means the live counter costs one RPC read instead of six, and the
  // interval only runs while the tab is visible. It also stops for good once
  // the collection sells out.
  const {
    data: onChainMinted,
    isError: isMintedError,
    refetch: refetchMinted,
  } = useReadContract({
    address: LAUNCHPAD_ADDRESS,
    chainId: giwaSepolia.id,
    abi: AriwaNFTABI,
    functionName: "totalMinted",
    query: {
      enabled: configured,
      refetchInterval: (query) => {
        const minted = query.state.data;
        if (
          minted !== undefined &&
          configValues &&
          configValues.supply > 0n &&
          minted >= configValues.supply
        ) {
          return false;
        }
        return LIVE_MINT_REFRESH_MS;
      },
      refetchOnWindowFocus: true,
    },
  });

  const values = useMemo<MintValues | undefined>(() => {
    if (!configValues || onChainMinted === undefined) return undefined;
    return { ...configValues, minted: onChainMinted };
  }, [configValues, onChainMinted]);

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
    (quantity: number, mintedAtSubmit: bigint) => {
      const expected = mintedAtSubmit + BigInt(quantity);
      setMintedFloor((current) =>
        current !== null && current > expected ? current : expected,
      );
      void refetchMinted();
    },
    [refetchMinted],
  );

  const liveValues = hydrated ? displayValues : undefined;
  const status = getDropStatus(liveValues, {
    configured,
    // A single failed poll is not fatal: keep showing the last known supply
    // and let the interval catch up. Only surface an error when the counter
    // has never loaded.
    error:
      hydrated &&
      (isError || (isMintedError && onChainMinted === undefined)),
  });

  const displayName =
    hydrated && typeof collectionName === "string" && collectionName.trim()
      ? collectionName
      : "ARIWA";
  const displaySymbol =
    hydrated && typeof collectionSymbol === "string" && collectionSymbol.trim()
      ? collectionSymbol
      : "ARIWA";

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
            ipMinted={ipMinted}
            onMinted={handleMinted}
            onRetryContract={() => {
              void refetch();
              void refetchMinted();
            }}
          />
        </div>
      </section>

      <LaunchpadFaq values={liveValues} symbol={displaySymbol} currency={currency} />
      <LaunchpadCta />
    </>
  );
}
