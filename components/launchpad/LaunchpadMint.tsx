"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { isAddress } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import { AriwaNFTABI, giwaSepolia, LAUNCHPAD_NFT_ADDRESS } from "@/lib/contracts";
import { LaunchpadCta } from "./LaunchpadCta";
import { LaunchpadFaq } from "./LaunchpadFaq";
import { LaunchpadMintCard } from "./LaunchpadMintCard";
import { LaunchpadPreview } from "./LaunchpadPreview";
import { LaunchpadSummary } from "./LaunchpadSummary";
import { getDropStatus, type MintValues } from "./launchpad-format";

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

    const [price, supply, walletLimit, minted, publicMintOpen] = mintConfig;
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
    };
  }, [mintConfig]);

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
      />

      <section className="section-shell pt-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-5">
          <LaunchpadPreview />
          <LaunchpadMintCard
            configured={configured}
            values={liveValues}
            status={status}
            contractAddress={LAUNCHPAD_ADDRESS}
            onMinted={handleMinted}
            onRetryContract={() => void refetch()}
          />
        </div>
      </section>

      <LaunchpadFaq values={liveValues} symbol={displaySymbol} />
      <LaunchpadCta />
    </>
  );
}
