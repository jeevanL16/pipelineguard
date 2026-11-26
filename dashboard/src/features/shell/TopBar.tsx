import React, { useEffect, useRef, useState } from "react";
import { Menu, RefreshCw, Search } from "lucide-react";
import { Kbd } from "../../ui";
import { ThemeSwitch } from "./ThemeSwitch";

function formatRelativeAge(updatedAtMs: number | null, nowMs: number): string {
  if (!updatedAtMs) return "Checking…";
  const diffSec = Math.max(0, Math.floor((nowMs - updatedAtMs) / 1000));
  if (diffSec < 3) return "Updated just now";
  if (diffSec < 60) return `Updated ${diffSec}s ago`;
  const mins = Math.floor(diffSec / 60);
  return `Updated ${mins}m ago`;
}

export interface TopBarProps {
  pageTitle: string;
  onOpenMobileNav: () => void;
  onOpenCommandPalette: () => void;
  commandButtonRef?: React.RefObject<HTMLButtonElement | null>;
  onRefresh: () => void;
  isFetching: boolean;
  isDegraded: boolean;
  lastUpdatedAt: number | null;
}

export function TopBar({
  pageTitle,
  onOpenMobileNav,
  onOpenCommandPalette,
  commandButtonRef,
  onRefresh,
  isFetching,
  isDegraded,
  lastUpdatedAt,
}: TopBarProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const refreshBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="h-14 px-4 sm:px-6 bg-[var(--pg-canvas)] border-b border-[var(--pg-line)] flex items-center justify-between gap-3 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
          className="sm:hidden p-2 -ml-2 rounded-[8px] text-[var(--pg-text-muted)] hover:text-[var(--pg-text)] hover:bg-[var(--pg-raised)] cursor-pointer"
        >
          <Menu size={18} strokeWidth={1.5} />
        </button>
        <h1 className="pg-headline-sm text-[var(--pg-text)] m-0 truncate">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          ref={commandButtonRef}
          type="button"
          onClick={onOpenCommandPalette}
          className="inline-flex items-center gap-2 h-8 px-2.5 rounded-[8px] bg-[var(--pg-panel)] border border-[var(--pg-line)] hover:border-[var(--pg-line-strong)] text-[var(--pg-text-muted)] hover:text-[var(--pg-text)] pg-body-sm transition-colors cursor-pointer"
        >
          <Search size={14} strokeWidth={1.5} />
          <span className="hidden md:inline">Search</span>
          <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
        </button>

        <div className="hidden lg:block">
          <ThemeSwitch compact />
        </div>

        {/* Static status indicator + accessible text + relative time (no pulsing dot per DESIGN.md) */}
        <div
          className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 h-8 rounded-[8px] border border-[var(--pg-line)] bg-[var(--pg-panel)] pg-body-sm"
          title={
            isDegraded
              ? "Two or more consecutive status checks failed"
              : "Connected to local FastAPI backend"
          }
        >
          <span
            aria-hidden="true"
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              backgroundColor: isDegraded ? "var(--pg-high)" : "var(--pg-pass)",
            }}
          />
          <span className="text-[var(--pg-text)] pg-label-sm">
            {isDegraded ? "Degraded" : "Connected"}
          </span>
          <span className="text-[var(--pg-text-muted)] pg-label-sm pg-tnum hidden md:inline">
            {formatRelativeAge(lastUpdatedAt, nowMs)}
          </span>
        </div>

        <button
          ref={refreshBtnRef}
          type="button"
          onClick={onRefresh}
          aria-label={isFetching ? "Refreshing telemetry" : "Refresh telemetry"}
          className="inline-flex items-center justify-center w-8 h-8 rounded-[8px] border border-[var(--pg-line)] bg-[var(--pg-panel)] hover:border-[var(--pg-line-strong)] text-[var(--pg-text-muted)] hover:text-[var(--pg-text)] transition-colors cursor-pointer"
        >
          <RefreshCw
            size={15}
            strokeWidth={1.5}
            className={isFetching ? "motion-safe:animate-spin text-[var(--pg-primary)]" : ""}
          />
        </button>
      </div>
    </header>
  );
}
