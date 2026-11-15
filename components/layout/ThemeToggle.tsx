"use client";

import type { MouseEvent } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useTheme } from "@/components/providers/ThemeProvider";

/**
 * The icon swap is CSS-only (`dark:` variants), so the button is correct on the
 * very first paint — before React has read the stored preference — and never
 * flashes the wrong glyph during hydration.
 */
export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { toggleTheme } = useTheme();

  // The page-wide reveal blooms out of (and collapses back into) the button,
  // so pass its centre rather than the raw click point — keyboard users get
  // the same origin as pointer users.
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    toggleTheme({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className={cn(
        "group inline-flex items-center justify-center rounded-full border border-ink/10 bg-paper/60 text-ink-soft transition",
        "hover:border-iris/30 hover:bg-paper hover:text-iris",
        "dark:border-white/10 dark:bg-white/[0.04] dark:text-ink-mute dark:hover:border-iris/40 dark:hover:bg-white/[0.07] dark:hover:text-iris",
        compact ? "size-9" : "size-10",
        className,
      )}
    >
      <Moon className={cn("transition-transform duration-300 group-hover:-rotate-12", compact ? "size-4" : "size-4.5", "dark:hidden")} />
      <Sun className={cn("hidden transition-transform duration-300 group-hover:rotate-45", compact ? "size-4" : "size-4.5", "dark:block")} />
    </button>
  );
}
