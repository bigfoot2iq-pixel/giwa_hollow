"use client";

import { useState, useEffect } from "react";

export function GlobalLoader() {
  const [isLoading, setIsLoading] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const hide = () => {
      setIsFading(true);
      hideTimer = setTimeout(() => setIsLoading(false), 400);
    };

    // This overlay used to wait up to 5s for every font weight (including the
    // 1.1 MB icon font) and held pointer events while it did. It is branding,
    // not a dependency: paint the first frame, then fade out. The font-face
    // swap still prevents a flash of fallback text once content is visible.
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(hide);
    });
    const safety = setTimeout(hide, 1_200);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(safety);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  if (!isLoading) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--loader-bg)",
        opacity: isFading ? 0 : 1,
        transition: "opacity 0.4s ease-out",
        // Never intercept clicks, even at full opacity.
        pointerEvents: "none",
      }}
    >
      {/* Spinner */}
      <div
        style={{
          width: 36,
          height: 36,
          border: "3px solid var(--line-strong)",
          borderTopColor: "var(--ariwa-iris)",
          borderRadius: "50%",
          animation: "globalLoaderSpin 0.8s linear infinite",
        }}
      />
      <p
        style={{
          marginTop: 18,
          fontFamily: "var(--font-bricolage), ui-sans-serif, sans-serif",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.26em",
          color: "var(--ariwa-ink)",
        }}
      >
        ARIWA
      </p>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes globalLoaderSpin {
              to { transform: rotate(360deg); }
            }
          `,
        }}
      />
    </div>
  );
}
