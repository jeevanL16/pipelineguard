import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { runViewTransition } from "../motion/motion";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "pg-theme";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function readStoredPreference(): ThemePreference {
  try {
    const val = localStorage.getItem(THEME_STORAGE_KEY);
    if (val === "light" || val === "dark" || val === "system") return val;
  } catch {
    // ignore storage failures
  }
  return "system";
}

export function applyThemeToDom(pref: ThemePreference, resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.setAttribute("data-theme-mode", pref);
  document.documentElement.style.colorScheme = resolved;
}

/**
 * Updates the browser favicon cleanly without idle animation when open CRITICAL findings exist.
 */
export function syncCriticalFavicon(hasOpenCritical: boolean): void {
  if (typeof document === "undefined") return;
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  const target = hasOpenCritical ? "/favicon-critical.svg" : "/favicon.svg";
  if (!link.getAttribute("href")?.endsWith(target)) {
    link.setAttribute("href", target);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPrefState] = useState<ThemePreference>(() => readStoredPreference());
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const listener = () => setSystemTheme(mq.matches ? "light" : "dark");
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const resolvedTheme: ResolvedTheme =
    preference === "system" ? systemTheme : preference;

  useEffect(() => {
    applyThemeToDom(preference, resolvedTheme);
  }, [preference, resolvedTheme]);

  const setPreference = (nextPref: ThemePreference) => {
    try {
      if (nextPref === "system") {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        localStorage.setItem(THEME_STORAGE_KEY, nextPref);
      }
    } catch {
      // ignore storage errors
    }
    const nextResolved = nextPref === "system" ? getSystemTheme() : nextPref;
    runViewTransition(() => {
      applyThemeToDom(nextPref, nextResolved);
      setPrefState(nextPref);
    });
  };

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return ctx;
}
