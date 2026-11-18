import { cn } from "@/lib/utils/cn";

function hashAddress(address: string): number {
  let hash = 2166136261;
  const value = address.toLowerCase();

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

/**
 * A deterministic wallet sigil in the ARIWA iris family. Keeping it local means
 * the profile never waits on an avatar service (or leaks a wallet address to
 * one), while the two-hue gradient makes each wallet feel recognisable.
 */
export function WalletAvatar({
  address,
  className,
}: {
  address: string;
  className?: string;
}) {
  const hash = hashAddress(address);
  const hue = 238 + (hash % 42);
  const secondHue = (hue + 22 + ((hash >> 8) % 28)) % 360;
  const initials = address.slice(2, 4).toUpperCase();

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white/70 text-white shadow-[0_18px_34px_-20px_rgba(39,33,50,0.7)] dark:border-white/15",
        className,
      )}
      style={{
        backgroundImage: [
          "radial-gradient(120% 120% at 26% 16%, rgba(255,255,255,0.52), transparent 46%)",
          `linear-gradient(135deg, hsl(${hue} 68% 62%) 0%, hsl(${secondHue} 72% 46%) 100%)`,
        ].join(", "),
      }}
    >
      <span className="font-header text-[18px] font-extrabold tracking-[-0.04em] drop-shadow-[0_2px_6px_rgba(24,16,44,0.35)]">
        {initials}
      </span>
      <span className="pointer-events-none absolute -right-1 -top-1 size-6 rounded-full bg-white/35 blur-[6px]" />
    </span>
  );
}
