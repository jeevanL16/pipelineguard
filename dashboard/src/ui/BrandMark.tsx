import React from "react";

interface GateMarkProps {
  size?: number;
  monochrome?: boolean;
  className?: string;
}

/**
 * PipelineGuard Gate mark (DESIGN.md spec):
 * Two vertical posts and a lintel on a 24px grid, with a 4px verdigris notch cut into the lintel centre.
 */
export function GateMark({ size = 24, monochrome = false, className = "" }: GateMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* Left post */}
      <rect x="4" y="4" width="3" height="16" fill="currentColor" />
      {/* Right post */}
      <rect x="17" y="4" width="3" height="16" fill="currentColor" />
      {/* Left lintel segment */}
      <rect x="4" y="4" width="6" height="3" fill="currentColor" />
      {/* Right lintel segment */}
      <rect x="14" y="4" width="6" height="3" fill="currentColor" />
      {/* Verified centre notch */}
      <rect
        x="10"
        y="4"
        width="4"
        height="3"
        fill={monochrome ? "currentColor" : "var(--pg-primary)"}
      />
    </svg>
  );
}

export function BrandWordmark({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 text-[var(--pg-text)] select-none ${className}`}
    >
      <GateMark size={22} />
      {!compact && (
        <span
          className="font-semibold text-[16px] tracking-[-0.02em] leading-none"
          style={{ fontFamily: "var(--pg-font-sans)" }}
        >
          PipelineGuard
        </span>
      )}
    </span>
  );
}
