import { cn } from "@/lib/utils/cn";

export const TELEGRAM_URL = "https://t.me/ARIWA_Official";

/**
 * Official Telegram mark, kept as a single SVG path so it renders sharply and
 * inherits the surrounding text colour.
 */
export function TelegramLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

/**
 * Compact icon-only link to ARIWA's Telegram channel. Sits alongside the
 * header's other round controls, so it matches their size and hover treatment
 * instead of introducing another heavy pill.
 */
export function TelegramIconLink({ className }: { className?: string }) {
  return (
    <a
      href={TELEGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="ARIWA on Telegram"
      title="ARIWA on Telegram"
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-paper/60 text-[#229ED9] transition",
        "hover:border-[#229ED9]/40 hover:bg-[#229ED9]/10",
        "dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-[#229ED9]/45 dark:hover:bg-[#229ED9]/15",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris-soft/80 focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
        className,
      )}
    >
      <TelegramLogo className="size-[18px]" />
    </a>
  );
}
