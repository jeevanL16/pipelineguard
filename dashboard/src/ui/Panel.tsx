import React, { useEffect, useRef } from "react";
import { getSeverityMeta } from "../rules/severity";
import type { Severity } from "../rules/schemas";
import { MOTION, prefersReducedMotion } from "../motion/motion";
import { Button } from "./Button";

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padding?: "none" | "md" | "lg";
}

export function Panel({
  children,
  padding = "lg",
  className = "",
  ...props
}: PanelProps) {
  const padClass =
    padding === "none" ? "p-0" : padding === "md" ? "p-4" : "p-6";
  return (
    <div
      className={`bg-[var(--pg-panel)] text-[var(--pg-text)] border border-[var(--pg-line)] rounded-[14px] ${padClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CodeLineAnnotation {
  severity?: Severity;
  diff?: "removed" | "added";
}

export interface CodePanelProps {
  title?: string;
  headerRight?: React.ReactNode;
  code: string;
  forceDark?: boolean;
  activeScanLine?: number | null;
  highlightedLines?: Set<number>;
  lineAnnotations?: Record<number, CodeLineAnnotation>;
  onLineHover?: (line: number | null) => void;
  onLineSelect?: (line: number) => void;
  focusedLine?: number | null;
  className?: string;
}

export function CodePanel({
  title,
  headerRight,
  code,
  forceDark = false,
  activeScanLine = null,
  highlightedLines,
  lineAnnotations = {},
  onLineHover,
  onLineSelect,
  focusedLine = null,
  className = "",
}: CodePanelProps) {
  const lines = code.split(/\r?\n/);
  const scanCursorRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = scanCursorRef.current;
    if (!el || activeScanLine === null || prefersReducedMotion()) return;
    if (typeof el.animate === "function") {
      el.animate(
        [
          { opacity: 0.45, transform: "scaleY(0.75)" },
          { opacity: 1, transform: "scaleY(1)" },
        ],
        { duration: MOTION.scanLineMs, easing: "linear", fill: "forwards" }
      );
    }
  }, [activeScanLine]);

  return (
    <div
      className={`rounded-[14px] border border-[var(--pg-line)] overflow-hidden bg-[var(--pg-canvas)] text-[var(--pg-text)] ${
        forceDark ? "pg-force-dark" : ""
      } ${className}`}
    >
      {(title || headerRight) && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--pg-line)] bg-[var(--pg-panel)]">
          <div className="pg-code-sm text-[var(--pg-text-muted)] truncate">{title}</div>
          {headerRight}
        </div>
      )}

      <div className="overflow-x-auto py-3 px-1">
        <div role="region" aria-label={title || "Workflow YAML"} className="min-w-max pg-code-md">
          {lines.map((lineText, idx) => {
            const lineNum = idx + 1;
            const ann = lineAnnotations[lineNum];
            const isScanning = activeScanLine === lineNum;
            const isHighlighted = highlightedLines?.has(lineNum) || focusedLine === lineNum;

            let bgVar: string | undefined;
            let borderColorVar = "transparent";

            if (ann?.diff === "removed") {
              bgVar = "var(--pg-critical-tint)";
              borderColorVar = "var(--pg-critical)";
            } else if (ann?.diff === "added") {
              bgVar = "var(--pg-pass-tint)";
              borderColorVar = "var(--pg-pass)";
            } else if (ann?.severity) {
              const meta = getSeverityMeta(ann.severity);
              bgVar = meta.tintVar;
              borderColorVar = meta.fgVar;
            }

            if (isHighlighted && !bgVar) {
              bgVar = "var(--pg-raised)";
            }

            return (
              <div
                key={`${lineNum}-${ann?.diff ?? "normal"}`}
                tabIndex={onLineSelect ? -1 : undefined}
                data-line={lineNum}
                onMouseEnter={() => onLineHover?.(lineNum)}
                onMouseLeave={() => onLineHover?.(null)}
                onClick={() => onLineSelect?.(lineNum)}
                className={`relative flex items-start pr-4 transition-colors duration-120 ease-out ${
                  ann?.diff === "removed" ? "line-through opacity-80" : ""
                } ${isHighlighted ? "ring-1 ring-inset ring-[var(--pg-primary)]/60" : ""}`}
                style={{
                  backgroundColor: bgVar,
                  borderLeft: `3px solid ${borderColorVar}`,
                }}
              >
                {/* 2px verdigris scan cursor bar */}
                {isScanning && (
                  <span
                    ref={scanCursorRef}
                    aria-hidden="true"
                    className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--pg-primary)]"
                  />
                )}
                <span
                  aria-hidden="true"
                  className="select-none text-right w-10 pr-3 pl-2 text-[var(--pg-text-muted)] shrink-0"
                >
                  {lineNum}
                </span>
                <span className="whitespace-pre text-[var(--pg-text)]">
                  {lineText || " "}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Static skeleton block — intentionally does not shimmer per DESIGN.md.
 */
export function Skeleton({
  width = "100%",
  height = "16px",
  className = "",
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-[4px] bg-[var(--pg-raised)] ${className}`}
      style={{ width, height }}
    />
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="border border-[var(--pg-line)] bg-[var(--pg-panel)] rounded-[14px] px-6 py-10 text-left space-y-3">
      <h3 className="pg-headline-sm text-[var(--pg-text)] m-0">{title}</h3>
      <p className="pg-body-sm text-[var(--pg-text-muted)] max-w-[40rem] m-0">{description}</p>
      {actionLabel && onAction && (
        <div className="pt-1">
          <Button variant="secondary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ErrorPanel({
  title = "Unable to load data",
  message,
  requestId,
  onRetry,
}: {
  title?: string;
  message: string;
  requestId?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="border border-[var(--pg-line-strong)] bg-[var(--pg-critical-tint)] rounded-[14px] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div className="space-y-1">
        <div className="pg-label-md text-[var(--pg-critical)]">{title}</div>
        <p className="pg-body-sm text-[var(--pg-text)] m-0">{message}</p>
        {requestId && (
          <div className="pg-code-sm text-[var(--pg-text-muted)]">
            Request ID: {requestId}
          </div>
        )}
      </div>
      {onRetry && (
        <Button variant="secondary" size="compact" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
