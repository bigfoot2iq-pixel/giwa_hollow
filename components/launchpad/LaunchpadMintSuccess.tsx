"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ArrowUpRight, Check, Share2, X } from "lucide-react";
import type { Hash } from "viem";
import { giwaSepolia } from "@/lib/contracts";

/**
 * A soft confirmation card, not a receipt. It names the drop, shows a resident,
 * and gives the visitor the two things they usually want next: the transaction
 * and somewhere to share it.
 */
export function LaunchpadMintSuccess({
  open,
  onClose,
  hash,
  quantity,
}: {
  open: boolean;
  onClose: () => void;
  hash?: Hash;
  quantity: number;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") handleClose();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const shareText = `Just minted ${quantity} ${quantity === 1 ? "NFT" : "NFTs"} from ARIWA Genesis on GIWA.`;
  const shareHref = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

  function trapFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/45 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="launchpad-success-title"
          aria-describedby="launchpad-success-description"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={trapFocus}
          className="relative w-full max-w-[430px] overflow-hidden rounded-[30px] border border-ink/10 bg-paper p-4 shadow-[0_44px_120px_-28px_rgba(39,33,50,0.65)] sm:p-5 dark:shadow-[0_44px_120px_-24px_rgba(0,0,0,0.9)]"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full bg-lilac/30 blur-[70px] dark:bg-[#d8c9fa]/10"
          />

          <button
            ref={closeRef}
            type="button"
            onClick={handleClose}
            aria-label="Close mint confirmation"
            className="absolute right-3 top-3 z-20 inline-flex size-9 items-center justify-center rounded-full border border-ink/10 bg-paper/70 text-ink-soft transition hover:border-iris/30 hover:text-iris"
          >
            <X className="size-4" />
          </button>

          <div className="relative flex flex-col items-center px-3 pt-3 text-center">
            <span className="inline-flex size-11 items-center justify-center rounded-full border border-success/25 bg-success/10 text-success-ink">
              <Check className="size-5" />
            </span>
            <p className="mt-3 font-mono text-[8.5px] uppercase tracking-[0.22em] text-success-ink">
              Mint confirmed
            </p>
            <h2
              id="launchpad-success-title"
              className="mt-1.5 font-header text-[24px] font-extrabold leading-none tracking-[-0.04em] text-ink"
            >
              {quantity === 1
                ? "One resident is yours."
                : `${quantity} residents are yours.`}
            </h2>
            <p
              id="launchpad-success-description"
              className="mt-2 text-[11px] leading-5 text-ink-mute"
            >
              Minted on {giwaSepolia.name} and delivered to your wallet.
            </p>
          </div>

          <div className="relative mt-4 aspect-square overflow-hidden rounded-[22px] border border-ink/10 bg-cream-2">
            <Image
              src="/art/nft/1.webp"
              alt="ARIWA Genesis resident artwork"
              fill
              sizes="(max-width: 640px) 90vw, 390px"
              className="object-cover"
            />
            <div className="absolute left-3 top-3 rounded-full border border-ink/10 bg-cream/85 px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-soft backdrop-blur">
              ARIWA Genesis
            </div>
            <div className="absolute bottom-3 right-3 rounded-full border border-ink/10 bg-cream/85 px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-mute backdrop-blur">
              GIWA
            </div>
          </div>

          <p className="mt-2 text-center text-[10px] text-ink-mute">
            Screenshot this card, or share the mint with the Hollow.
          </p>

          <div className="mt-4 grid gap-2">
            {hash ? (
              <a
                href={`${giwaSepolia.blockExplorers.default.url}/tx/${hash}`}
                target="_blank"
                rel="noreferrer"
                className="btn-iris w-full text-[12px]"
              >
                <ArrowUpRight className="size-4" />
                View transaction
              </a>
            ) : null}
            <a
              href={shareHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-ink/10 bg-paper/60 text-[11px] font-semibold text-ink-soft transition hover:border-iris/30 hover:bg-paper hover:text-iris"
            >
              <Share2 className="size-3.5" />
              Share on X
            </a>
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex h-11 items-center justify-center rounded-full text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-mute transition hover:text-ink"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
