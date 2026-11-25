import React, { useState } from "react";
import { Copy } from "lucide-react";
import { SeverityShapeIcon } from "./Badge";

export interface SealProps {
  digest: string;
  label?: string;
  animate?: boolean;
  className?: string;
}

/**
 * Gatehouse Verification Seal:
 * Bordered sm rectangle with check shape, "Verified", and 12-character SHA-256 digest
 * plus a working button to copy the full 64-character value.
 */
export function Seal({
  digest,
  label = "Verified",
  animate = false,
  className = "",
}: SealProps) {
  const [copied, setCopied] = useState(false);
  const shortDigest = digest.slice(0, 12);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(digest);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked in non-HTTPS contexts; gracefully ignore
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-[4px] px-2.5 py-1.5 border border-[var(--pg-pass)]/40 bg-[var(--pg-pass-tint)] text-[var(--pg-pass)] pg-code-sm ${
        animate ? "pg-seal-stamp" : ""
      } ${className}`}
    >
      <SeverityShapeIcon shape="check" />
      <span className="font-medium font-sans pg-label-sm">{label}</span>
      <span
        className="text-[var(--pg-text)] select-all"
        title={`SHA-256: ${digest}`}
      >
        {shortDigest}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[var(--pg-panel)] text-[var(--pg-text-muted)] hover:text-[var(--pg-text)] border border-[var(--pg-line)] text-[11px] leading-none cursor-pointer transition-colors"
        aria-label={copied ? "Full SHA-256 digest copied" : "Copy full SHA-256 digest"}
      >
        <Copy size={12} strokeWidth={1.5} />
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}
