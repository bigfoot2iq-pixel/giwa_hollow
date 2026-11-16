"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { giwaSepolia } from "@/lib/contracts";
import { DropStatusPill } from "./DropStatusPill";
import {
  formatCount,
  formatEth,
  type DropStatus,
  type MintValues,
} from "./launchpad-format";

const STAT_LABELS = ["Supply", "Minted", "Price", "Max / wallet"] as const;

export function LaunchpadSummary({
  collectionName,
  symbol,
  status,
  values,
  displayMinted,
  contractAddress,
  configured,
}: {
  collectionName: string;
  symbol: string;
  status: DropStatus;
  values?: MintValues;
  displayMinted?: bigint;
  contractAddress?: `0x${string}`;
  configured: boolean;
}) {
  const supply = values?.supply;
  const minted = displayMinted ?? values?.minted;
  const remaining =
    supply !== undefined && minted !== undefined && supply > minted
      ? supply - minted
      : 0n;

  const progress =
    supply !== undefined && supply > 0n && minted !== undefined
      ? Math.min(100, (Number(minted) / Number(supply)) * 100)
      : null;

  const statValues = [
    supply !== undefined ? formatCount(supply) : "—",
    minted !== undefined ? formatCount(minted) : "—",
    values ? formatEth(values.price) : "—",
    values ? formatCount(values.walletLimit) : "—",
  ];

  return (
    <section className="section-shell pt-8 sm:pt-11">
      <div className="ui-container relative overflow-hidden rounded-[30px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-32 size-72 rounded-full bg-lilac/30 blur-[90px] dark:bg-[#d8c9fa]/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-28 size-64 rounded-full bg-blush/25 blur-[80px] dark:bg-[#f6c7d8]/10"
        />

        <div className="relative p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="relative flex size-12 shrink-0 rounded-2xl border border-ink/10 bg-butter p-[3px] shadow-[0_12px_26px_-18px_rgba(39,33,50,0.8)] sm:size-[52px]">
                <span className="relative flex-1 overflow-hidden rounded-[12px] bg-cream-2">
                  <Image
                    src="/art/nft/1.webp"
                    alt=""
                    fill
                    sizes="52px"
                    className="object-cover"
                  />
                </span>
              </span>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate font-header text-[24px] font-extrabold leading-none tracking-[-0.045em] text-ink sm:text-[28px]">
                    {collectionName}
                  </h1>
                  <DropStatusPill status={status} />
                </div>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-5 text-ink-mute">
                  <span>The Hollow&apos;s genesis drop. Soft residents, on-chain supply.</span>
                  <span aria-hidden="true" className="size-1 rounded-full bg-iris/35" />
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
                    {symbol} · {giwaSepolia.name}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <ShareButton />
              {configured && contractAddress ? (
                <a
                  href={`${giwaSepolia.blockExplorers.default.url}/address/${contractAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open the collection on GIWA Explorer"
                  title="View contract on GIWA Explorer"
                  className="inline-flex size-9 items-center justify-center rounded-full border border-ink/10 bg-paper/60 text-ink-soft transition hover:border-iris/30 hover:bg-paper hover:text-iris"
                >
                  <ArrowUpRight className="size-3.5" />
                </a>
              ) : null}
              <Link
                href="/create"
                className="inline-flex h-9 items-center gap-2 rounded-full border border-ink/10 bg-paper/60 px-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft transition hover:border-iris/30 hover:bg-paper hover:text-iris"
              >
                <Sparkles className="size-3.5" />
                Launch yours
              </Link>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-ink/[0.08] bg-ink/[0.06] sm:grid-cols-4">
            {statValues.map((value, index) => (
              <div key={STAT_LABELS[index]} className="bg-cream-2/75 px-3.5 py-3">
                <dd className="tabular font-header text-[19px] font-extrabold leading-none tracking-[-0.03em] text-ink sm:text-[20px]">
                  {value}
                </dd>
                <dt className="mt-1.5 font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-mute">
                  {STAT_LABELS[index]}
                </dt>
              </div>
            ))}
          </dl>

          <div className="mt-3 flex items-center gap-3">
            <div
              role="progressbar"
              aria-label="Collection mint progress"
              aria-valuemin={0}
              aria-valuemax={supply !== undefined ? Number(supply) : 0}
              aria-valuenow={minted !== undefined ? Number(minted) : 0}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[0.07]"
            >
              {progress !== null ? (
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#8b77f2,#6c55e0_55%,#b96ab8)] transition-[width] duration-700 ease-out"
                  style={{ width: `${Math.max(progress, 1)}%` }}
                />
              ) : null}
            </div>
            <span className="shrink-0 font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-mute">
              {supply !== undefined && minted !== undefined
                ? `${formatCount(remaining)} left`
                : "—"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "ARIWA Genesis",
          text: "Mint ARIWA Genesis on GIWA.",
          url,
        });
        return;
      }

      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Launch link copied");
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      // A dismissed share sheet or a blocked clipboard is not an error worth
      // interrupting the visitor with.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      aria-label="Share the launchpad"
      title="Share the launchpad"
      className="inline-flex size-9 items-center justify-center rounded-full border border-ink/10 bg-paper/60 text-ink-soft transition hover:border-iris/30 hover:bg-paper hover:text-iris"
    >
      {copied ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />}
    </button>
  );
}
