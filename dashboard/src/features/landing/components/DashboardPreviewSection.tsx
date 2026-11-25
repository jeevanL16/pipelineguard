import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { Badge, Button, Panel } from "../../../ui";

interface HotspotSpec {
  id: "queue" | "drawer" | "audit";
  label: string;
  title: string;
  detail: string;
  positionClass: string;
}

const HOTSPOTS: readonly HotspotSpec[] = [
  {
    id: "queue",
    label: "1. Needs attention queue",
    title: "Needs attention queue",
    detail:
      "Open findings sorted strictly by severity first, then oldest age, so engineers know which pipeline failure needs triage next.",
    positionClass: "top-6 left-6",
  },
  {
    id: "drawer",
    label: "2. Evidence drawer",
    title: "Side-by-side evidence drawer",
    detail:
      "Selecting any row slides open the offending YAML line in severity tint alongside remediation diff and one-click undoable status controls.",
    positionClass: "top-6 right-6",
  },
  {
    id: "audit",
    label: "3. Audit log",
    title: "Immutable audit log",
    detail:
      "Every finding status transition writes a timestamped audit record showing prior status, new status, and actor.",
    positionClass: "bottom-6 left-1/2 -translate-x-1/2",
  },
];

export function DashboardPreviewSection() {
  const [activeHotspot, setActiveHotspot] = useState<HotspotSpec["id"]>("queue");
  const current = HOTSPOTS.find((h) => h.id === activeHotspot) ?? HOTSPOTS[0];

  return (
    <section className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="max-w-[40rem] space-y-2">
          <h2 className="pg-headline-lg text-[var(--pg-text)] m-0">
            Built for daily triage
          </h2>
          <p className="pg-body-md text-[var(--pg-text-muted)] m-0">
            Inspect the queue, evidence drawer, and audit trail in the active theme. Focus any marker to read how it works.
          </p>
        </div>

        <NavLink to="/app" className="no-underline">
          <Button variant="secondary" size="compact">
            Open live dashboard
          </Button>
        </NavLink>
      </div>

      {/* Real-layout themed dashboard preview with 3 focusable hotspots */}
      <Panel padding="none" className="overflow-hidden">
        <div className="relative bg-[var(--pg-canvas)] p-4 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Queue surface */}
            <div className="lg:col-span-7 border border-[var(--pg-line)] rounded-[10px] bg-[var(--pg-panel)] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="pg-label-md text-[var(--pg-text)]">Needs attention</span>
                <span className="pg-data-md text-[var(--pg-text-muted)]">3 open</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 p-2 rounded-[6px] bg-[var(--pg-raised)] border border-[var(--pg-line)]">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge severity="CRITICAL" />
                    <span className="pg-code-sm text-[var(--pg-text)]">PG-WF-001</span>
                    <span className="pg-body-sm text-[var(--pg-text-muted)] truncate">
                      pipe-auth-service
                    </span>
                  </div>
                  <span className="pg-data-md text-[var(--pg-text)]">4d</span>
                </div>
                <div className="flex items-center justify-between gap-2 p-2 rounded-[6px] border border-[var(--pg-line)]">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge severity="CRITICAL" />
                    <span className="pg-code-sm text-[var(--pg-text)]">secrets</span>
                    <span className="pg-body-sm text-[var(--pg-text-muted)] truncate">
                      pipe-payments-api
                    </span>
                  </div>
                  <span className="pg-data-md text-[var(--pg-text)]">1d</span>
                </div>
              </div>
            </div>

            {/* Evidence drawer preview surface */}
            <div className="lg:col-span-5 border border-[var(--pg-line)] rounded-[10px] bg-[var(--pg-panel)] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="pg-label-md text-[var(--pg-text)]">Evidence · EVT-PG-001</span>
                <Badge severity="CRITICAL" />
              </div>
              <div className="p-2.5 rounded-[6px] bg-[var(--pg-critical-tint)] border-l-[3px] border-[var(--pg-critical)] pg-code-sm text-[var(--pg-text)]">
                run: ./build.sh "${`{{ github.event.issue.body }}`}"
              </div>
              <div className="p-2.5 rounded-[6px] bg-[var(--pg-pass-tint)] border-l-[3px] border-[var(--pg-pass)] pg-code-sm text-[var(--pg-text)]">
                + env: ISSUE_BODY: ${`{{ github.event.issue.body }}`}
              </div>
            </div>

            {/* Audit log strip */}
            <div className="lg:col-span-12 border border-[var(--pg-line)] rounded-[10px] bg-[var(--pg-panel)] p-3.5 flex flex-wrap items-center justify-between gap-3 pg-body-sm">
              <div className="flex items-center gap-3">
                <span className="pg-label-md text-[var(--pg-text)]">Audit log</span>
                <span className="pg-code-sm text-[var(--pg-text-muted)]">
                  EVT-PG-004 · OPEN → RESOLVED
                </span>
              </div>
              <span className="pg-data-md text-[var(--pg-text-muted)]">
                Actor: admin · Recorded in SQLite
              </span>
            </div>
          </div>

          {/* 3 Focusable Hotspot Controls + Accessible Callout */}
          <div className="mt-5 pt-4 border-t border-[var(--pg-line)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Dashboard walkthrough hotspots">
              {HOTSPOTS.map((spot) => {
                const selected = activeHotspot === spot.id;
                return (
                  <button
                    key={spot.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveHotspot(spot.id)}
                    onMouseEnter={() => setActiveHotspot(spot.id)}
                    onFocus={() => setActiveHotspot(spot.id)}
                    className={`h-8 px-3 rounded-[6px] pg-label-sm border transition-colors cursor-pointer ${
                      selected
                        ? "bg-[var(--pg-raised)] text-[var(--pg-primary)] border-[var(--pg-primary)]"
                        : "bg-[var(--pg-panel)] text-[var(--pg-text-muted)] border-[var(--pg-line)] hover:text-[var(--pg-text)]"
                    }`}
                  >
                    {spot.label}
                  </button>
                );
              })}
            </div>

            <div className="md:max-w-md pg-body-sm text-[var(--pg-text)]">
              <span className="font-medium">{current.title}:</span>{" "}
              <span className="text-[var(--pg-text-muted)]">{current.detail}</span>
            </div>
          </div>
        </div>
      </Panel>
    </section>
  );
}
