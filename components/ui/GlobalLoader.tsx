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
      '400 1em "Plus Jakarta Sans"',
      '500 1em "Plus Jakarta Sans"',
      '600 1em "Plus Jakarta Sans"',
      '700 1em "Plus Jakarta Sans"',
      '700 1em "Space Grotesk"',
      '400 1em "DM Serif Display"',
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
        background: "linear-gradient(to bottom, #003597 0%, #0062df 100%)",
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
          border: "3px solid rgba(255,255,255,0.25)",
          borderTopColor: "#ffffff",
          borderRadius: "50%",
          animation: "globalLoaderSpin 0.8s linear infinite",
        }}
      />

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
