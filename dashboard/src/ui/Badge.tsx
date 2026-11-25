import React from "react";
import { getSeverityMeta, type SeverityShape } from "../rules/severity";
import type { BadgeTone } from "../rules/schemas";

export function SeverityShapeIcon({
  shape,
  className = "",
}: {
  shape: SeverityShape;
  className?: string;
}) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {shape === "diamond" && <polygon points="6,1 11,6 6,11 1,6" fill="currentColor" />}
      {shape === "triangle" && <polygon points="6,1.5 11,10.5 1,10.5" fill="currentColor" />}
      {shape === "square" && <rect x="2" y="2" width="8" height="8" fill="currentColor" />}
      {shape === "circle" && <circle cx="6" cy="6" r="4" fill="currentColor" />}
      {shape === "dash" && <rect x="2" y="5" width="8" height="2" fill="currentColor" />}
      {shape === "check" && (
        <path
          d="M2.25 6.25L4.75 8.75L9.75 3.25"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      )}
    </svg>
  );
}

export interface BadgeProps {
  severity: BadgeTone | string;
  label?: string;
  className?: string;
}

/**
 * Severity / status badge encoding three signals at once: color, SVG shape, and label.
 */
export function Badge({ severity, label, className = "" }: BadgeProps) {
  const meta = getSeverityMeta(severity);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[4px] px-2 py-0.5 pg-label-sm border select-none ${className}`}
      style={{
        backgroundColor: meta.tintVar,
        color: meta.fgVar,
        borderColor: "var(--pg-line)",
      }}
    >
      <SeverityShapeIcon shape={meta.shape} />
      <span>{label ?? meta.label}</span>
    </span>
  );
}
