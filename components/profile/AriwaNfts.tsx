"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { ARIWA_PIECES } from "@/lib/art";
import { giwaSepolia, LAUNCHPAD_NFT_ADDRESS } from "@/lib/contracts";
import { useAriwaNfts } from "@/lib/hooks";
import type { AriwaNft } from "@/lib/hooks/useAriwaNfts";

const EXPLORER_URL =
  giwaSepolia.blockExplorers?.default.url || "https://sepolia-explorer.giwa.io";

function tokenLabel(id: number): string {
  return String(id).padStart(4, "0");
}

function NftCard({ nft, contract }: { nft: AriwaNft; contract: string | null }) {
  const localPiece = ARIWA_PIECES.find((piece) => piece.id === nft.id);
  const image = localPiece?.src ?? nft.image;
  const detail = localPiece
    ? `${localPiece.hat} · ${localPiece.eyes}`
    : "ARIWA NFT · GIWA";

  const explorerHref = contract
    ? `${EXPLORER_URL}/token/${contract}/instance/${nft.id}`
    : `${EXPLORER_URL}/token/${LAUNCHPAD_NFT_ADDRESS ?? ""}`;

  return (
    <a
      href={explorerHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View ${nft.name} on the GIWA explorer`}
      className="group block overflow-hidden rounded-[22px] border border-ink/10 bg-paper shadow-[0_22px_44px_-38px_rgba(39,33,50,0.65)] transition duration-300 hover:-translate-y-1 hover:border-iris/25 hover:shadow-[0_28px_54px_-34px_rgba(39,33,50,0.55)]"
    >
      <div className="relative aspect-square overflow-hidden bg-cream-3">
        <Image
          src={image}
          alt={nft.name}
          fill
          sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, (max-width: 1280px) 23vw, 230px"
          className="object-cover transition duration-700 ease-out group-hover:scale-[1.045]"
        />
        <span className="absolute left-2.5 top-2.5 rounded-full border border-white/20 bg-[#1d1826]/65 px-2 py-1 font-mono text-[9px] font-medium tracking-[0.08em] text-white backdrop-blur-md">
          #{tokenLabel(nft.id)}
        </span>
        <span className="absolute bottom-2.5 right-2.5 flex size-8 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white opacity-0 backdrop-blur-md transition duration-300 group-hover:opacity-100">
          <ArrowUpRight className="size-3.5" />
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 px-3.5 py-3">
        <div className="min-w-0">
          <p className="truncate font-header text-[12.5px] font-extrabold tracking-[-0.02em] text-ink">
            {nft.name}
          </p>
          <p className="mt-0.5 truncate font-mono text-[8px] uppercase tracking-[0.12em] text-ink-mute">
            {detail}
          </p>
        </div>
        <span className="iris-dot shrink-0" aria-hidden="true" />
      </div>
    </a>
  );
}

function NftSkeletonGrid() {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      aria-hidden="true"
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[22px] border border-ink/10 bg-paper"
        >
          <div className="aspect-square animate-pulse bg-ink/[0.06]" />
          <div className="space-y-2 px-3.5 py-3">
            <div className="h-3 w-20 animate-pulse rounded bg-ink/10" />
            <div className="h-2 w-14 animate-pulse rounded bg-ink/[0.06]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function NftEmpty() {
  const piece = ARIWA_PIECES[0];

  return (
    <div className="ui-container relative overflow-hidden rounded-[28px] px-6 py-7 sm:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-iris/[0.09] blur-3xl"
      />
      <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <span className="relative size-24 shrink-0 overflow-hidden rounded-full border-4 border-white/70 shadow-[0_16px_30px_-18px_rgba(39,33,50,0.5)] dark:border-white/15">
          <Image src={piece.src} alt="" fill sizes="96px" className="object-cover" />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-mute">
            An empty shelf
          </p>
          <h3 className="mt-2 font-header text-xl font-extrabold tracking-[-0.03em] text-ink">
            No residents yet.
          </h3>
          <p className="mt-2 max-w-lg text-[12px] leading-6 text-ink-soft">
            Your wallet does not hold an ARIWA NFT yet. Mint one from the
            launchpad and it will appear here beside your balance.
          </p>
        </div>
        <Link
          href="/launchpad"
          className="btn-ink h-11 shrink-0 px-5 text-[11px] sm:ml-auto"
        >
          Mint a resident
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

function NftError({
  message,
  onRetry,
  isRetrying,
}: {
  message?: string;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <div className="rounded-[28px] border border-danger/20 bg-danger/[0.045] px-6 py-6 sm:px-8">
      <div className="flex items-start gap-3.5">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger-ink">
          <AlertTriangle className="size-4" />
        </span>
        <div>
          <h3 className="font-header text-lg font-extrabold tracking-[-0.03em] text-ink">
            Your residents are hiding.
          </h3>
          <p className="mt-1.5 max-w-xl text-[12px] leading-6 text-ink-soft">
            {message ||
              "The GIWA explorer did not answer in time. Your NFTs are safe — try the shelf again in a moment."}
          </p>
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="btn-ghost mt-4 h-9 px-4 text-[11px]"
          >
            {isRetrying ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            {isRetrying ? "Checking again…" : "Try again"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AriwaNfts({ address }: { address: string }) {
  const {
    nfts,
    count,
    contract,
    isLoading,
    isError,
    isRefetching,
    error,
    refetch,
  } = useAriwaNfts(address);

  const ownedLabel = isLoading || isError ? "—" : count;

  return (
    <section className="mt-12 sm:mt-14" aria-labelledby="profile-nfts-title">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">The collection</p>
          <h2
            id="profile-nfts-title"
            className="display mt-3 text-[clamp(1.8rem,3.6vw,2.6rem)] text-ink"
          >
            Your ARIWA NFTs
          </h2>
          <p className="mt-2.5 max-w-xl text-[12.5px] leading-6 text-ink-soft">
            {isLoading
              ? "Reading your shelf from GIWA Sepolia…"
              : count === 0
                ? "Every resident you hold will live here."
                : count === 1
                  ? "One resident is living in your wallet."
                  : `${count} residents are living in your wallet.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isRefetching && !isLoading && (
            <Loader2 className="size-3.5 animate-spin text-ink-mute" />
          )}
          <span className="pill">
            <span className="iris-dot" aria-hidden="true" />
            {ownedLabel} owned
          </span>
          <Link href="/launchpad" className="btn-soft h-10 px-4 text-[11px]">
            Mint
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      <div className="mt-6" aria-busy={isLoading}>
        {isLoading ? (
          <NftSkeletonGrid />
        ) : isError ? (
          <NftError
            message={error?.message}
            onRetry={() => void refetch()}
            isRetrying={isRefetching}
          />
        ) : nfts.length === 0 ? (
          <NftEmpty />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {nfts.map((nft) => (
              <NftCard key={nft.id} nft={nft} contract={contract} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
