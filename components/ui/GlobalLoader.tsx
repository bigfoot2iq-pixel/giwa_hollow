"use client";

import { useState, useEffect } from "react";

export function GlobalLoader() {
  const [isLoading, setIsLoading] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const hide = () => {
      setIsFading(true);
      setTimeout(() => setIsLoading(false), 500);
    };

    let isCancelled = false;

    const requiredFonts = [
      '400 1em "DM Sans"',
      '500 1em "DM Sans"',
      '600 1em "DM Sans"',
      '700 1em "Bricolage Grotesque"',
      '400 1em "Material Symbols Outlined"',
    ];

    const areAllFontsReady = () =>
      requiredFonts.every((font) => document.fonts.check(font, "BESbswy"));

    const waitUntilFontsAreApplied = async () => {
      // All fonts are now served locally via next/font — document.fonts.ready
      // reliably waits for all @font-face rules to register before we load.
      await document.fonts.ready;
      await Promise.all(requiredFonts.map((font) => document.fonts.load(font, "BESbswy")));

      if (areAllFontsReady() || isCancelled) return;

      const deadline = Date.now() + 4500;
      while (!isCancelled && Date.now() < deadline) {
        if (areAllFontsReady()) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    };

    waitUntilFontsAreApplied().then(() => {
      if (isCancelled) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!isCancelled) hide();
        });
      });
    });

    // Safety timeout — never block longer than 5s
    const timeout = setTimeout(hide, 5000);

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
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
        pointerEvents: isFading ? "none" : "auto",
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
      <p
        style={{
          marginTop: 6,
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: 8,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--ariwa-iris)",
        }}
      >
        the hollow
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
