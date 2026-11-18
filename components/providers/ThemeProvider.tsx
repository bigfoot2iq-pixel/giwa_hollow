"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "ariwa-theme";
const DARK_COLOR = "#0c0a11";
const LIGHT_COLOR = "#FBF7EF";

/** Runs before paint in the document head so the first frame is already dark. */
export const THEME_INIT_SCRIPT = `(function(){try{var k="${THEME_STORAGE_KEY}";var s=localStorage.getItem(k);var m=window.matchMedia("(prefers-color-scheme: dark)").matches;var d=s==="dark"||s===null||(s==="system"&&m);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

/** Viewport point the theme reveal should radiate from (the toggle's centre). */
export type ThemeRevealOrigin = { x: number; y: number };

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: (origin?: ThemeRevealOrigin) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/* ---------------------------------------------------------------------------
   The preference lives in localStorage and is exposed as an external store, so
   React reads it without a setState-in-effect and hydration keeps using the
   server snapshot until the client is ready.
   --------------------------------------------------------------------------- */

const themeListeners = new Set<() => void>();
let cachedTheme: Theme | null = null;

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "dark";
}

function getThemeSnapshot(): Theme {
  if (cachedTheme === null) cachedTheme = readStoredTheme();
  return cachedTheme;
}

function getThemeServerSnapshot(): Theme {
  return "dark";
}

function subscribeTheme(callback: () => void): () => void {
  themeListeners.add(callback);
  return () => {
    themeListeners.delete(callback);
  };
}

function emitTheme(): void {
  themeListeners.forEach((listener) => listener());
}

function persistTheme(next: Theme): void {
  cachedTheme = next;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Private mode — the in-memory choice still works for this session.
  }
  emitTheme();
}

function getMediaQuery(): MediaQueryList | null {
  if (typeof window === "undefined") return null;
  return window.matchMedia("(prefers-color-scheme: dark)");
}

function subscribeSystemTheme(callback: () => void): () => void {
  const media = getMediaQuery();
  if (!media) return () => undefined;
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getSystemThemeSnapshot(): boolean {
  return getMediaQuery()?.matches ?? false;
}

function getSystemThemeServerSnapshot(): boolean {
  return false;
}

function syncMetaTheme(resolved: ResolvedTheme): void {
  const color = resolved === "dark" ? DARK_COLOR : LIGHT_COLOR;
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", color));
}

function applyTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;

  // Keep the mobile browser chrome in step with the switch.
  syncMetaTheme(resolved);
}

/* ---------------------------------------------------------------------------
   Theme switch
   The button hands us its centre, and the browser snapshots the page before
   and after the class flip. CSS (see globals.css) then wipes between the two
   snapshots with a circle anchored on the toggle: daylight grows out of it,
   while going dark shrinks the old light frame back into it so the night rolls
   in from the edges. Browsers without the View Transitions API — or visitors
   who asked for reduced motion — get the plain instant flip.
   --------------------------------------------------------------------------- */

let themeRevealSeq = 0;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function commitTheme(next: ResolvedTheme, origin?: ThemeRevealOrigin): void {
  if (
    !origin ||
    typeof document === "undefined" ||
    typeof document.startViewTransition !== "function" ||
    prefersReducedMotion()
  ) {
    applyTheme(next);
    persistTheme(next);
    return;
  }

  const root = document.documentElement;
  const x = Math.round(origin.x);
  const y = Math.round(origin.y);

  // Reach the furthest viewport corner (plus a hair for antialiasing) so the
  // circle always finishes by covering the entire page.
  const reach =
    Math.ceil(
      Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)),
    ) + 8;

  // A newer click must be allowed to take over from a running reveal without
  // the older transition's cleanup stripping its styles.
  const seq = ++themeRevealSeq;

  root.style.setProperty("--theme-reveal-x", `${x}px`);
  root.style.setProperty("--theme-reveal-y", `${y}px`);
  root.style.setProperty("--theme-reveal-reach", `${reach}px`);
  root.dataset.themeReveal = next === "light" ? "to-light" : "to-dark";

  const cleanup = () => {
    if (themeRevealSeq !== seq) return;
    delete root.dataset.themeReveal;
    root.style.removeProperty("--theme-reveal-x");
    root.style.removeProperty("--theme-reveal-y");
    root.style.removeProperty("--theme-reveal-reach");
  };

  const transition = document.startViewTransition(() => {
    // Flip the class synchronously so the incoming snapshot is already themed;
    // persisting afterwards lets React adopt the same value.
    applyTheme(next);
    persistTheme(next);
  });

  // `finished` rejects when another reveal interrupts this one — clean up in
  // both outcomes so no stale styles linger.
  transition.finished.then(cleanup, cleanup);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);
  const systemPrefersDark = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemThemeSnapshot,
    getSystemThemeServerSnapshot,
  );

  const resolvedTheme: ResolvedTheme =
    theme === "system" ? (systemPrefersDark ? "dark" : "light") : theme;

  // Apply the resolved theme to <html>. On the first pass, read the client
  // store directly: during hydration the server snapshot can resolve to
  // "light" for a moment, and applying that would undo the pre-paint class
  // from the head script and flash. Reading the true preference makes the
  // first pass a no-op when the script already ran, and a repair when it did
  // not.
  const appliedOnce = useRef(false);
  useEffect(() => {
    if (!appliedOnce.current) {
      appliedOnce.current = true;
      const stored = getThemeSnapshot();
      applyTheme(stored === "system" ? (getSystemThemeSnapshot() ? "dark" : "light") : stored);
      return;
    }
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  // Keep tabs in sync when the preference changes elsewhere.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      cachedTheme = null;
      emitTheme();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((next: Theme) => persistTheme(next), []);

  const toggleTheme = useCallback((origin?: ThemeRevealOrigin) => {
    const current = getThemeSnapshot();
    const active: ResolvedTheme =
      current === "system" ? (getSystemThemeSnapshot() ? "dark" : "light") : current;
    commitTheme(active === "dark" ? "light" : "dark", origin);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return context;
}
