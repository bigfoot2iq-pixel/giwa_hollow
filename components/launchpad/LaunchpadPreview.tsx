"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { NFT_PIECES } from "@/lib/art";
import { cn } from "@/lib/utils/cn";

const COPY: Record<number, string> = {
  1: "Keeps the Hollow in bloom. A sunflower crown, one bright eye, and a wink for the road.",
  2112: "The busiest resident in the Hollow. Striped beanie, tiny wings, always first to the nectar.",
  314: "A leafy beanie and a soft spot for new growth. Every garden starts with one small seed.",
};

const PREVIEW_ITEMS = [NFT_PIECES[0], NFT_PIECES[3], NFT_PIECES[7]].map((piece) => ({
  ...piece,
  blurb: COPY[piece.id] ?? "",
}));

const SLIDE_MS = 6_000;

function subscribeToReducedMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function reducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function serverReducedMotionSnapshot() {
  return false;
}

/**
 * The genesis set. The set details and the artwork are sibling blocks: the
 * details sit on top and the artwork fills the rest of the card. On desktop the
 * card stretches to match the mint column, so the art grows into any extra
 * height instead of leaving a gap underneath.
 */
export function LaunchpadPreview() {
  const [activeId, setActiveId] = useState(PREVIEW_ITEMS[0].id);
  const [playingOverride, setPlayingOverride] = useState<boolean | null>(null);
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    reducedMotionSnapshot,
    serverReducedMotionSnapshot,
  );
  const playing = playingOverride ?? !prefersReducedMotion;

  const active =
    PREVIEW_ITEMS.find((item) => item.id === activeId) ?? PREVIEW_ITEMS[0];
  const activeIndex = Math.max(
    0,
    PREVIEW_ITEMS.findIndex((item) => item.id === active.id),
  );

  useEffect(() => {
    if (!playing) return;

    const timer = window.setTimeout(() => {
      const next = PREVIEW_ITEMS[(activeIndex + 1) % PREVIEW_ITEMS.length];
      setActiveId(next.id);
    }, SLIDE_MS);

    return () => window.clearTimeout(timer);
  }, [activeIndex, playing]);

  function selectItem(id: number) {
    setActiveId(id);
    setPlayingOverride(false);
  }

  return (
    <div className="ui-container flex h-full flex-col overflow-hidden rounded-[30px]">
      <div className="border-b border-ink/[0.07] p-4 sm:p-5 lg:p-3">
        <div className="flex min-w-0 flex-col gap-4 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center lg:gap-x-4 lg:gap-y-3 xl:flex xl:flex-row xl:items-center xl:gap-4">
          <div className="min-w-0 xl:w-[220px] xl:shrink-0">
            <div className="flex items-center justify-between gap-2">
              <p className="eyebrow">The genesis set</p>
              <span className="font-mono text-[7px] uppercase tracking-[0.16em] text-ink-faint">
                GIWA Sepolia
              </span>
            </div>
            <h2
              aria-live="polite"
              className="mt-2.5 font-header text-[28px] font-extrabold leading-none tracking-[-0.04em] text-ink sm:text-[32px] xl:mt-1.5 xl:text-[24px]"
            >
              {active.name}
            </h2>
            <p className="mt-2 text-[10.5px] font-medium uppercase tracking-[0.13em] text-ink-mute xl:mt-1 xl:text-[9px]">
              {active.role} · {active.trait}
            </p>
          </div>

          <p className="min-w-0 flex-1 text-[11.5px] leading-5 text-ink-soft xl:text-[10.5px] xl:leading-[1.45]">
            {active.blurb}
          </p>

          <div className="border-t border-ink/[0.08] pt-3.5 lg:col-span-2 xl:w-[260px] xl:shrink-0 xl:border-t-0 xl:pt-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-ink-mute">
                In the set
              </p>
              <span className="font-mono text-[8.5px] text-ink-faint">
                {String(PREVIEW_ITEMS.length).padStart(2, "0")} residents
              </span>
            </div>

            <div
              role="tablist"
              aria-label="Genesis collection preview"
              className="mt-2.5 grid grid-cols-1 gap-2 min-[520px]:grid-cols-3 xl:mt-1.5 xl:grid-cols-3 xl:gap-1.5"
            >
              {PREVIEW_ITEMS.map((item) => {
                const selected = item.id === active.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls="launchpad-preview-stage"
                    aria-label={`Preview ${item.name}`}
                    onClick={() => selectItem(item.id)}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-xl border p-1.5 text-left transition xl:gap-1.5 xl:p-1",
                      selected
                        ? "border-iris/35 bg-iris/[0.06]"
                        : "border-ink/[0.07] bg-paper/45 hover:border-ink/15 hover:bg-paper/80",
                    )}
                  >
                    <span className="relative size-9 shrink-0 overflow-hidden rounded-lg border border-ink/[0.08] bg-cream-2 xl:size-6">
                      <Image
                        src={item.src}
                        alt=""
                        loading="lazy"
                        width={144}
                        height={144}
                        className="size-full object-cover"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-[11px] font-semibold leading-4 xl:text-[10px]",
                          selected ? "text-ink" : "text-ink-soft group-hover:text-ink",
                        )}
                      >
                        {item.name}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[8px] uppercase tracking-[0.13em] text-ink-mute xl:hidden">
                        {item.role}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mr-1 size-1.5 shrink-0 rounded-full transition xl:hidden",
                        selected ? "bg-iris" : "bg-transparent",
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div
        id="launchpad-preview-stage"
        className="relative aspect-square w-full overflow-hidden bg-cream-2 lg:aspect-auto lg:min-h-[240px] lg:flex-1"
      >
        {PREVIEW_ITEMS.map((item, index) => {
          const isActive = index === activeIndex;

          return (
            <Image
              key={`backdrop-${item.id}`}
              src={item.src}
              alt=""
              aria-hidden
              fill
              loading="eager"
              sizes="720px"
              className={cn(
                "hidden scale-110 object-cover blur-2xl transition-opacity duration-700 ease-out lg:block",
                isActive ? "opacity-45" : "opacity-0",
              )}
            />
          );
        })}

        <div className="absolute inset-0">
          {PREVIEW_ITEMS.map((item, index) => {
            const isActive = index === activeIndex;

            return (
              <Image
                key={item.id}
                src={item.src}
                alt={isActive ? item.alt : ""}
                aria-hidden={!isActive}
                fill
                loading="eager"
                preload={index === 0}
                sizes="(max-width: 1024px) 92vw, 720px"
                className={cn(
                  "object-cover transition-[opacity,transform] duration-700 ease-out lg:object-contain lg:object-center",
                  isActive
                    ? "scale-100 opacity-100"
                    : "scale-[1.015] opacity-0",
                )}
              />
            );
          })}
        </div>

        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlayingOverride(!playing)}
            aria-label={playing ? "Pause image rotation" : "Play image rotation"}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-cream/85 px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-soft backdrop-blur transition hover:border-iris/30 hover:text-iris"
          >
            {playing ? <Pause className="size-2.5" /> : <Play className="size-2.5" />}
            {playing ? "Pause" : "Play"}
          </button>

          <div className="rounded-full border border-ink/10 bg-cream/85 px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-mute backdrop-blur">
            {String(activeIndex + 1).padStart(2, "0")}
            <span className="text-ink-faint"> / </span>
            {String(PREVIEW_ITEMS.length).padStart(2, "0")}
          </div>
        </div>
      </div>
    </div>
  );
}
