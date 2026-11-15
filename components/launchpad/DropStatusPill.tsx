import { cn } from "@/lib/utils/cn";
import type { DropStatus, DropTone } from "./launchpad-format";

const TONE_STYLES: Record<DropTone, string> = {
  live: "border-success/25 bg-success/[0.09] text-success-ink",
  closed: "border-warning/30 bg-warning/[0.09] text-warning-ink",
  soldout: "border-ink/[0.12] bg-ink/[0.04] text-ink-mute",
  setup: "border-ink/[0.12] bg-ink/[0.04] text-ink-mute",
  loading: "border-ink/[0.1] bg-ink/[0.03] text-ink-mute",
  error: "border-danger/25 bg-danger/[0.07] text-danger",
};

/**
 * The compact capsule used for drop state. It keeps the live dot from the rest
 * of ARIWA so the launchpad reads as part of the same world.
 */
export function DropStatusPill({
  status,
  className,
}: {
  status: DropStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em]",
        TONE_STYLES[status.tone],
        className,
      )}
    >
      {status.tone === "live" ? (
        <span className="live-dot" />
      ) : (
        <span className="size-1.5 rounded-full bg-current opacity-70" />
      )}
      {status.label}
    </span>
  );
}
