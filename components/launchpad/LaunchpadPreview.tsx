"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { GALLERY_PIECES } from "@/lib/art";
import { cn } from "@/lib/utils/cn";

const PREVIEW_ITEMS = GALLERY_PIECES.filter(
  (piece) => piece.id !== 1 && piece.id !== 2112 && piece.id !== 314,
).slice(0, 10);

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
 * The genesis set showcase. A fixed description sits above the artwork, the
 * piece itself fills the frame edge to edge, and the set is paged with arrows,
 * dots, and a quiet auto-rotation instead of a strip of thumbnails.
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

  const activeIndex = Math.max(
    0,
    PREVIEW_ITEMS.findIndex((item) => item.id === activeId),
  );

  useEffect(() => {
    if (!playing) return;

    const timer = window.setTimeout(() => {
      const next = PREVIEW_ITEMS[(activeIndex + 1) % PREVIEW_ITEMS.length];
      setActiveId(next.id);
    }, SLIDE_MS);

    return () => window.clearTimeout(timer);
  }, [activeIndex, playing]);

  function goTo(index: number) {
    const next =
      PREVIEW_ITEMS[(index + PREVIEW_ITEMS.length) % PREVIEW_ITEMS.length];
    setActiveId(next.id);
    setPlayingOverride(false);
  }

  return (
    <div className="ui-container self-start overflow-hidden rounded-[30px]">
      <div className="border-b border-ink/[0.07] bg-paper/35 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow">The genesis set</p>
          <span className="font-mono text-[7px] uppercase tracking-[0.16em] text-ink-faint">
            GIWA Sepolia
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <h2 className="font-header text-[30px] font-extrabold leading-none tracking-[-0.04em] text-ink sm:text-[34px]">
            Ten faces from the Hollow
          </h2>

          <p className="text-[11.5px] leading-5 text-ink-soft sm:max-w-[340px] sm:border-l sm:border-ink/[0.08] sm:pl-5">
            Every resident is one eye, one wink, and a hat they will not take
            off. The rest is personality.
          </p>
        </div>
      </div>

      <div
        id="launchpad-preview-stage"
        className="relative aspect-[3/2] w-full overflow-hidden bg-cream-2"
      >
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
              draggable={false}
              sizes="(max-width: 1024px) 92vw, 720px"
              className={cn(
                "object-cover object-[50%_30%] transition-[opacity,transform] duration-700 ease-out",
                isActive ? "scale-100 opacity-100" : "scale-[1.015] opacity-0",
              )}
            />
          );
        })}

        <button
          type="button"
          onClick={() => goTo(activeIndex - 1)}
          aria-label="Previous resident"
          className="absolute left-3 top-1/2 z-10 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-ink/10 bg-cream/85 text-ink-soft shadow-[0_14px_30px_-20px_rgba(39,33,50,0.9)] backdrop-blur transition hover:border-iris/30 hover:bg-cream hover:text-iris sm:left-4 sm:size-10"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => goTo(activeIndex + 1)}
          aria-label="Next resident"
          className="absolute right-3 top-1/2 z-10 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-ink/10 bg-cream/85 text-ink-soft shadow-[0_14px_30px_-20px_rgba(39,33,50,0.9)] backdrop-blur transition hover:border-iris/30 hover:bg-cream hover:text-iris sm:right-4 sm:size-10"
        >
          <ChevronRight className="size-4" />
        </button>

        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 sm:bottom-4 sm:left-4">
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

      <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
        <p className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-ink-faint">
          In the set
        </p>

        <div
          role="group"
          aria-label="Choose a resident"
          className="flex items-center gap-1"
        >
          {PREVIEW_ITEMS.map((item, index) => {
            const selected = index === activeIndex;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Show ${item.name}`}
                aria-current={selected ? "true" : undefined}
                className="group flex h-6 items-center px-0.5"
              >
                <span
                  className={cn(
                    "block h-1.5 rounded-full transition-all duration-300",
                    selected
                      ? "w-5 bg-iris"
                      : "w-1.5 bg-ink/15 group-hover:bg-iris/40",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
