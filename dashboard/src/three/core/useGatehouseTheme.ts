import { useEffect, useRef, useState } from "react";
import { Color } from "three";
import type { Severity } from "../../rules/schemas";

export type GatehouseResolvedTheme = "dark" | "light";

export interface GatehouseColorPalette {
  canvas: Color;
  panel: Color;
  raised: Color;
  line: Color;
  lineStrong: Color;
  text: Color;
  textMuted: Color;
  primary: Color;
  onPrimary: Color;
  critical: Color;
  high: Color;
  medium: Color;
  low: Color;
  info: Color;
  pass: Color;
  criticalTint: Color;
  highTint: Color;
  mediumTint: Color;
  lowTint: Color;
  passTint: Color;
  ink: Color;
}

export interface GatehouseThemeState {
  resolvedTheme: GatehouseResolvedTheme;
  version: number;
  colors: GatehouseColorPalette;
  darkColors: GatehouseColorPalette;
  severityColor: (severity: Severity | "PASS" | "INFO", forceDark?: boolean) => Color;
  severityTint: (severity: Severity | "PASS" | "INFO", forceDark?: boolean) => Color;
}

function createEmptyPalette(): GatehouseColorPalette {
  return {
    canvas: new Color(),
    panel: new Color(),
    raised: new Color(),
    line: new Color(),
    lineStrong: new Color(),
    text: new Color(),
    textMuted: new Color(),
    primary: new Color(),
    onPrimary: new Color(),
    critical: new Color(),
    high: new Color(),
    medium: new Color(),
    low: new Color(),
    info: new Color(),
    pass: new Color(),
    criticalTint: new Color(),
    highTint: new Color(),
    mediumTint: new Color(),
    lowTint: new Color(),
    passTint: new Color(),
    ink: new Color(),
  };
}

const CSS_TOKEN_MAP: ReadonlyArray<readonly [keyof Omit<GatehouseColorPalette, "ink">, string]> = [
  ["canvas", "--pg-canvas"],
  ["panel", "--pg-panel"],
  ["raised", "--pg-raised"],
  ["line", "--pg-line"],
  ["lineStrong", "--pg-line-strong"],
  ["text", "--pg-text"],
  ["textMuted", "--pg-text-muted"],
  ["primary", "--pg-primary"],
  ["onPrimary", "--pg-on-primary"],
  ["critical", "--pg-critical"],
  ["high", "--pg-high"],
  ["medium", "--pg-medium"],
  ["low", "--pg-low"],
  ["info", "--pg-info"],
  ["pass", "--pg-pass"],
  ["criticalTint", "--pg-critical-tint"],
  ["highTint", "--pg-high-tint"],
  ["mediumTint", "--pg-medium-tint"],
  ["lowTint", "--pg-low-tint"],
  ["passTint", "--pg-pass-tint"],
];

function syncPaletteFromStyle(
  target: GatehouseColorPalette,
  style: CSSStyleDeclaration,
  resolvedTheme: GatehouseResolvedTheme
): void {
  for (const [key, cssVar] of CSS_TOKEN_MAP) {
    const val = style.getPropertyValue(cssVar).trim();
    if (val) {
      target[key].set(val);
    }
  }
  // Ink for isometric face shading is always the darker anchor of the active palette
  target.ink.copy(resolvedTheme === "dark" ? target.canvas : target.text);
}

function readForcedDarkTokens(target: GatehouseColorPalette): void {
  if (typeof document === "undefined" || !document.body) return;
  const probe = document.createElement("div");
  probe.className = "pg-force-dark";
  probe.style.position = "absolute";
  probe.style.width = "0";
  probe.style.height = "0";
  probe.style.pointerEvents = "none";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  try {
    const computed = window.getComputedStyle(probe);
    syncPaletteFromStyle(target, computed, "dark");
  } finally {
    probe.remove();
  }
}

export function resolveDomTheme(): GatehouseResolvedTheme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

function pickFromSeverity(
  palette: GatehouseColorPalette,
  severity: Severity | "PASS" | "INFO",
  useTint: boolean
): Color {
  if (severity === "CRITICAL") return useTint ? palette.criticalTint : palette.critical;
  if (severity === "HIGH") return useTint ? palette.highTint : palette.high;
  if (severity === "MEDIUM") return useTint ? palette.mediumTint : palette.medium;
  if (severity === "LOW") return useTint ? palette.lowTint : palette.low;
  if (severity === "PASS") return useTint ? palette.passTint : palette.pass;
  return useTint ? palette.raised : palette.info;
}

/**
 * Reads runtime CSS variables (--pg-*) into cached THREE.Color objects with zero hex literals.
 * Reacts live to data-theme switches and OS color-scheme transitions.
 */
export function useGatehouseTheme(onThemeChange?: () => void): GatehouseThemeState {
  const paletteRef = useRef<GatehouseColorPalette | null>(null);
  const darkPaletteRef = useRef<GatehouseColorPalette | null>(null);

  if (!paletteRef.current) {
    paletteRef.current = createEmptyPalette();
  }
  if (!darkPaletteRef.current) {
    darkPaletteRef.current = createEmptyPalette();
  }

  const [state, setState] = useState<{
    resolvedTheme: GatehouseResolvedTheme;
    version: number;
  }>(() => ({
    resolvedTheme: resolveDomTheme(),
    version: 0,
  }));

  const callbackRef = useRef(onThemeChange);
  useEffect(() => {
    callbackRef.current = onThemeChange;
  }, [onThemeChange]);

  useEffect(() => {
    const sync = () => {
      if (typeof document === "undefined" || typeof window === "undefined") return;
      const nextResolved = resolveDomTheme();
      const computed = window.getComputedStyle(document.documentElement);
      syncPaletteFromStyle(paletteRef.current!, computed, nextResolved);
      readForcedDarkTokens(darkPaletteRef.current!);
      setState((prev) => ({
        resolvedTheme: nextResolved,
        version: prev.version + 1,
      }));
      callbackRef.current?.();
    };

    sync();

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === "data-theme") {
          sync();
          break;
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true });

    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", sync);

    return () => {
      observer.disconnect();
      mq.removeEventListener("change", sync);
    };
  }, []);

  return {
    resolvedTheme: state.resolvedTheme,
    version: state.version,
    colors: paletteRef.current,
    darkColors: darkPaletteRef.current,
    severityColor: (severity, forceDark = false) =>
      pickFromSeverity(
        forceDark ? darkPaletteRef.current! : paletteRef.current!,
        severity,
        false
      ),
    severityTint: (severity, forceDark = false) =>
      pickFromSeverity(
        forceDark ? darkPaletteRef.current! : paletteRef.current!,
        severity,
        true
      ),
  };
}
