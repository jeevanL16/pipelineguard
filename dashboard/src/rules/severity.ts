import type { BadgeTone, FindingStatus, Severity } from "./schemas";

export type SeverityShape = "diamond" | "triangle" | "square" | "circle" | "dash" | "check";

export interface SeverityMeta {
  key: BadgeTone;
  label: string;
  shape: SeverityShape;
  order: number;
  weight: number;
  fgVar: string;
  tintVar: string;
  borderVar: string;
}

export const SEVERITY_META: Record<BadgeTone, SeverityMeta> = {
  CRITICAL: {
    key: "CRITICAL",
    label: "Critical",
    shape: "diamond",
    order: 0,
    weight: 40,
    fgVar: "var(--pg-critical)",
    tintVar: "var(--pg-critical-tint)",
    borderVar: "var(--pg-critical)",
  },
  HIGH: {
    key: "HIGH",
    label: "High",
    shape: "triangle",
    order: 1,
    weight: 25,
    fgVar: "var(--pg-high)",
    tintVar: "var(--pg-high-tint)",
    borderVar: "var(--pg-high)",
  },
  MEDIUM: {
    key: "MEDIUM",
    label: "Medium",
    shape: "square",
    order: 2,
    weight: 15,
    fgVar: "var(--pg-medium)",
    tintVar: "var(--pg-medium-tint)",
    borderVar: "var(--pg-medium)",
  },
  LOW: {
    key: "LOW",
    label: "Low",
    shape: "circle",
    order: 3,
    weight: 6,
    fgVar: "var(--pg-low)",
    tintVar: "var(--pg-low-tint)",
    borderVar: "var(--pg-low)",
  },
  INFO: {
    key: "INFO",
    label: "Info",
    shape: "dash",
    order: 4,
    weight: 2,
    fgVar: "var(--pg-info)",
    tintVar: "var(--pg-raised)",
    borderVar: "var(--pg-line-strong)",
  },
  PASS: {
    key: "PASS",
    label: "Pass",
    shape: "check",
    order: 5,
    weight: 0,
    fgVar: "var(--pg-pass)",
    tintVar: "var(--pg-pass-tint)",
    borderVar: "var(--pg-pass)",
  },
};

export function normalizeSeverity(raw?: string | null): Severity {
  const upper = (raw || "INFO").toUpperCase();
  if (
    upper === "CRITICAL" ||
    upper === "HIGH" ||
    upper === "MEDIUM" ||
    upper === "LOW" ||
    upper === "INFO"
  ) {
    return upper;
  }
  return "INFO";
}

export function getSeverityMeta(raw?: string | null): SeverityMeta {
  const upper = (raw || "INFO").toUpperCase();
  if (upper in SEVERITY_META) {
    return SEVERITY_META[upper as BadgeTone];
  }
  return SEVERITY_META.INFO;
}

export const STATUS_LABELS: Record<FindingStatus, string> = {
  OPEN: "Open",
  INVESTIGATING: "Investigating",
  RESOLVED: "Resolved",
  FALSE_POSITIVE: "False positive",
};

export const STATUS_VERBS: Record<FindingStatus, string> = {
  OPEN: "reopened",
  INVESTIGATING: "marked investigating",
  RESOLVED: "marked resolved",
  FALSE_POSITIVE: "marked false positive",
};
