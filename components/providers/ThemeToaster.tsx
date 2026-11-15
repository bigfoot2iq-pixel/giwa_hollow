"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/components/providers/ThemeProvider";

/** Sonner's palette is driven by the resolved theme instead of a fixed light box. */
export function ThemeToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      theme={resolvedTheme}
      toastOptions={{
        style: {
          background: "var(--ariwa-paper)",
          border: "1px solid var(--line-strong)",
          color: "var(--ariwa-ink)",
          borderRadius: "16px",
          boxShadow: "var(--toast-shadow)",
        },
      }}
    />
  );
}
