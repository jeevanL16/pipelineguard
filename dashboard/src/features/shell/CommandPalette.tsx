import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { GitBranch, Plus, RefreshCw, Search, ShieldAlert, SunMoon, ArrowUpRight } from "lucide-react";
import { Kbd } from "../../ui";
import { Badge } from "../../ui/Badge";
import { ALL_DASHBOARD_PAGES } from "./navConfig";
import { runViewTransition } from "../../motion/motion";
import { useTheme } from "../../app/theme";
import type { ApiPipeline, ApiSecurityEvent } from "../../services/api";

const RECENT_KEY = "pg-recent-commands";

interface RecentEntry {
  id: string;
  label: string;
  meta?: string;
  to: string;
}

function readRecents(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function pushRecent(entry: RecentEntry): void {
  try {
    const existing = readRecents().filter((r) => r.id !== entry.id);
    localStorage.setItem(RECENT_KEY, JSON.stringify([entry, ...existing].slice(0, 5)));
  } catch {
    // ignore
  }
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: readonly ApiSecurityEvent[];
  pipelines: readonly ApiPipeline[];
  onOpenConnect: () => void;
  onRefreshAll: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  events,
  pipelines,
  onOpenConnect,
  onRefreshAll,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { resolvedTheme, setPreference } = useTheme();
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<RecentEntry[]>(() => readRecents());

  useEffect(() => {
    if (open) {
      setRecents(readRecents());
      setQuery("");
    }
  }, [open]);

  const go = (to: string, recent?: RecentEntry) => {
    if (recent) pushRecent(recent);
    onOpenChange(false);
    if (`${location.pathname}${location.search}` !== to) {
      runViewTransition(() => navigate(to));
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50"
          style={{ backgroundColor: "var(--pg-scrim)" }}
        />
        <DialogPrimitive.Content
          aria-label="Command palette"
          className="fixed left-1/2 top-[12vh] -translate-x-1/2 z-50 w-[calc(100vw-32px)] max-w-[600px] rounded-[14px] bg-[var(--pg-panel)] text-[var(--pg-text)] border border-[var(--pg-line)] overflow-hidden outline-none"
          style={{ boxShadow: "var(--pg-overlay-shadow)" }}
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Jump to findings, pipelines, pages, or actions.
          </DialogPrimitive.Description>

          <Command label="Command palette" className="flex flex-col">
            <div className="flex items-center gap-3 px-4 h-12 border-b border-[var(--pg-line)]">
              <Search size={16} strokeWidth={1.5} className="text-[var(--pg-text-muted)] shrink-0" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Jump to finding, pipeline, page, or action…"
                className="flex-1 bg-transparent text-[var(--pg-text)] placeholder:text-[var(--pg-text-muted)] pg-body-md outline-none border-none"
              />
              <Kbd>Esc</Kbd>
            </div>

            <Command.List className="max-h-[380px] overflow-y-auto p-2 space-y-2">
              <Command.Empty className="py-8 px-4 text-center pg-body-sm text-[var(--pg-text-muted)]">
                No matching findings, pipelines, pages, or actions.
              </Command.Empty>

              {!query.trim() && recents.length > 0 && (
                <Command.Group
                  heading={
                    <div className="px-2 py-1 pg-label-sm text-[var(--pg-text-muted)]">
                      Recent
                    </div>
                  }
                >
                  {recents.map((item) => (
                    <Command.Item
                      key={`recent-${item.id}`}
                      value={`recent ${item.label} ${item.meta ?? ""}`}
                      onSelect={() => go(item.to, item)}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-[8px] pg-body-sm text-[var(--pg-text)] cursor-pointer aria-selected:bg-[var(--pg-raised)]"
                    >
                      <span className="truncate">{item.label}</span>
                      {item.meta && (
                        <span className="pg-code-sm text-[var(--pg-text-muted)] shrink-0">
                          {item.meta}
                        </span>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              <Command.Group
                heading={
                  <div className="px-2 py-1 pg-label-sm text-[var(--pg-text-muted)]">
                    Findings
                  </div>
                }
              >
                {events.slice(0, 8).map((evt) => (
                  <Command.Item
                    key={evt.event_id}
                    value={`${evt.event_id} ${evt.event_type} ${evt.pipeline_id ?? ""} ${evt.description}`}
                    onSelect={() =>
                      go(`/app/findings?finding=${encodeURIComponent(evt.event_id)}`, {
                        id: evt.event_id,
                        label: `${evt.event_type} (${evt.pipeline_id || "global"})`,
                        meta: evt.event_id,
                        to: `/app/findings?finding=${encodeURIComponent(evt.event_id)}`,
                      })
                    }
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-[8px] pg-body-sm cursor-pointer aria-selected:bg-[var(--pg-raised)]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ShieldAlert
                        size={16}
                        strokeWidth={1.5}
                        className="text-[var(--pg-text-muted)] shrink-0"
                      />
                      <span className="truncate text-[var(--pg-text)]">{evt.event_type}</span>
                      <span className="pg-code-sm text-[var(--pg-text-muted)] shrink-0">
                        {evt.event_id}
                      </span>
                    </div>
                    <Badge severity={evt.severity} />
                  </Command.Item>
                ))}
              </Command.Group>

              <Command.Group
                heading={
                  <div className="px-2 py-1 pg-label-sm text-[var(--pg-text-muted)]">
                    Pipelines
                  </div>
                }
              >
                {pipelines.slice(0, 8).map((pipe) => (
                  <Command.Item
                    key={pipe.pipeline_id}
                    value={`${pipe.pipeline_id} ${pipe.name} ${pipe.repository ?? ""} ${pipe.branch ?? ""}`}
                    onSelect={() =>
                      go(`/app/pipelines?highlight=${encodeURIComponent(pipe.pipeline_id)}`, {
                        id: pipe.pipeline_id,
                        label: pipe.name || pipe.pipeline_id,
                        meta: pipe.branch || "main",
                        to: `/app/pipelines`,
                      })
                    }
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-[8px] pg-body-sm cursor-pointer aria-selected:bg-[var(--pg-raised)]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <GitBranch
                        size={16}
                        strokeWidth={1.5}
                        className="text-[var(--pg-text-muted)] shrink-0"
                      />
                      <span className="pg-code-sm text-[var(--pg-text)]">{pipe.pipeline_id}</span>
                      <span className="text-[var(--pg-text-muted)] truncate">
                        {pipe.repository}
                      </span>
                    </div>
                    <span className="pg-code-sm text-[var(--pg-text-muted)] shrink-0">
                      {pipe.branch || "main"}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>

              <Command.Group
                heading={
                  <div className="px-2 py-1 pg-label-sm text-[var(--pg-text-muted)]">
                    Pages
                  </div>
                }
              >
                {ALL_DASHBOARD_PAGES.map((p) => {
                  const Icon = p.icon;
                  return (
                    <Command.Item
                      key={p.id}
                      value={`page ${p.label} ${p.to}`}
                      onSelect={() =>
                        go(p.to, { id: `page-${p.id}`, label: p.label, to: p.to })
                      }
                      className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] pg-body-sm text-[var(--pg-text)] cursor-pointer aria-selected:bg-[var(--pg-raised)]"
                    >
                      <Icon size={16} strokeWidth={1.5} className="text-[var(--pg-text-muted)]" />
                      <span>{p.label}</span>
                    </Command.Item>
                  );
                })}
                <Command.Item
                  value="page landing playground"
                  onSelect={() => go("/")}
                  className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-[8px] pg-body-sm text-[var(--pg-text)] cursor-pointer aria-selected:bg-[var(--pg-raised)]"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <ArrowUpRight size={16} strokeWidth={1.5} className="text-[var(--pg-text-muted)]" />
                    Public landing page & Playground
                  </span>
                </Command.Item>
              </Command.Group>

              <Command.Group
                heading={
                  <div className="px-2 py-1 pg-label-sm text-[var(--pg-text-muted)]">
                    Actions
                  </div>
                }
              >
                <Command.Item
                  value="action connect repository add pipeline"
                  onSelect={() => {
                    onOpenChange(false);
                    onOpenConnect();
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] pg-body-sm text-[var(--pg-text)] cursor-pointer aria-selected:bg-[var(--pg-raised)]"
                >
                  <Plus size={16} strokeWidth={1.5} className="text-[var(--pg-primary)]" />
                  <span>Connect repository</span>
                </Command.Item>

                <Command.Item
                  value="action toggle theme light dark"
                  onSelect={() => {
                    setPreference(resolvedTheme === "dark" ? "light" : "dark");
                    onOpenChange(false);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] pg-body-sm text-[var(--pg-text)] cursor-pointer aria-selected:bg-[var(--pg-raised)]"
                >
                  <SunMoon size={16} strokeWidth={1.5} className="text-[var(--pg-text-muted)]" />
                  <span>
                    Switch theme to {resolvedTheme === "dark" ? "Light" : "Dark"}
                  </span>
                </Command.Item>

                <Command.Item
                  value="action refresh data reload"
                  onSelect={() => {
                    onRefreshAll();
                    onOpenChange(false);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] pg-body-sm text-[var(--pg-text)] cursor-pointer aria-selected:bg-[var(--pg-raised)]"
                >
                  <RefreshCw size={16} strokeWidth={1.5} className="text-[var(--pg-text-muted)]" />
                  <span>Refresh dashboard records</span>
                </Command.Item>
              </Command.Group>
            </Command.List>

            <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--pg-line)] bg-[var(--pg-canvas)] pg-body-sm text-[var(--pg-text-muted)]">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd> Move
                </span>
                <span className="inline-flex items-center gap-1">
                  <Kbd>Enter</Kbd> Open
                </span>
              </div>
              <span className="inline-flex items-center gap-1">
                <Kbd>Esc</Kbd> Close
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
