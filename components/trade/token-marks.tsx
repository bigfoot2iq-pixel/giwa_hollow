import Image from "next/image";
import { cn } from "@/lib/utils/cn";

/** Official Ethereum mark, drawn in the brand blue used across the site. */
export function EthMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="#627EEA"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M11.944 17.97 4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0 4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z" />
    </svg>
  );
}

export function TokenMark({
  symbol,
  className,
}: {
  symbol: "ETH" | "ARIWA";
  className?: string;
}) {
  if (symbol === "ETH") {
    return (
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full border border-[#627EEA]/20 bg-[#627EEA]/10",
          className,
        )}
      >
        <EthMark className="size-4" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative size-7 shrink-0 overflow-hidden rounded-full border border-ink/10 bg-butter",
        className,
      )}
    >
      <Image
        src="/brand/ariwa-icon.webp"
        alt=""
        width={56}
        height={56}
        sizes="28px"
        className="size-full object-cover"
      />
    </span>
  );
}

export function TokenChip({ symbol }: { symbol: "ETH" | "ARIWA" }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-ink/10 bg-paper/85 py-1.5 pl-1.5 pr-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <TokenMark symbol={symbol} />
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink">
        {symbol}
      </span>
    </span>
  );
}
