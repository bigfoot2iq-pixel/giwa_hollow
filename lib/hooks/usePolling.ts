"use client";

import { useEffect, useRef } from "react";

/**
 * Interval polling that stops while the tab is in the background.
 *
 * A plain `setInterval` keeps firing in hidden tabs, so a browser left open on
 * the leaderboard overnight was spending thousands of API calls a day showing
 * nobody anything — the single largest source of function invocations on the
 * project. Here the timer only runs while the document is visible, and coming
 * back to a stale tab triggers one immediate catch-up refresh so the pause is
 * invisible to the user.
 */
export function usePolling(
  callback: () => void,
  intervalMs: number,
  enabled: boolean = true
) {
  // Kept in a ref so a new callback identity each render doesn't restart the
  // interval — otherwise a caller passing an inline function would poll far
  // faster than intervalMs.
  const savedCallback = useRef(callback);
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Seeded inside the effect: reading the clock during render is impure.
  const lastRunRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    lastRunRef.current = Date.now();
    let timer: ReturnType<typeof setInterval> | undefined;

    const run = () => {
      lastRunRef.current = Date.now();
      savedCallback.current();
    };

    const start = () => {
      if (timer !== undefined) return;
      timer = setInterval(run, intervalMs);
    };

    const stop = () => {
      if (timer === undefined) return;
      clearInterval(timer);
      timer = undefined;
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stop();
        return;
      }
      // Only catch up if a full window elapsed while hidden; otherwise the
      // existing data is still within its normal freshness budget.
      if (Date.now() - lastRunRef.current >= intervalMs) run();
      start();
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, enabled]);
}
