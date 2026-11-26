import React, { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useTheme } from "../../../app/theme";
import { analyzeWorkflowText } from "../../../rules/analyzer";
import { HERO_BROKEN_WORKFLOW } from "../../../rules/sampleWorkflows";
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
  const { resolvedTheme } = useTheme();
  const [activeHotspot, setActiveHotspot] = useState<HotspotSpec["id"]>("queue");
  const current = HOTSPOTS.find((h) => h.id === activeHotspot) ?? HOTSPOTS[0];
  const sampleAnalysis = useMemo(
    () => analyzeWorkflowText(HERO_BROKEN_WORKFLOW, ".github/workflows/ci.yml"),
    []
  );
  const featuredFinding =
    sampleAnalysis.findings.find((f) => f.ruleId === "PG-WF-001") ??
    sampleAnalysis.findings[0];
  const themeSuffix = resolvedTheme === "light" ? "light" : "dark";

  return (
    <section className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="max-w-[40rem] space-y-2">
          <h2 className="pg-headline-lg text-[var(--pg-text)] m-0">
            Built for daily triage
          </h2>
          <p className="pg-body-md text-[var(--pg-text-muted)] m-0">
            Inspect the queue, open posture, and risk trend in the active theme. Focus any marker to read how it works.
          </p>
        </div>

        <NavLink to="/app" className="no-underline">
          <Button variant="secondary" size="compact">
            Open live dashboard
          </Button>
        </NavLink>
      </div>

      {/* Real-layout CSS 3D layered dashboard preview with light/dark Playwright captures & flat fallback */}
      <Panel padding="none" className="overflow-hidden">
        <div className="pg-preview-3d-stage bg-[var(--pg-canvas)] p-4 sm:p-6">
          <div className="pg-preview-3d-grid grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Layer 0: Needs attention screenshot */}
            <figure className="m-0 lg:col-span-7 border border-[var(--pg-line)] rounded-[8px] bg-[var(--pg-panel)] overflow-hidden">
              <figcaption className="px-3 py-2 border-b border-[var(--pg-line)] pg-label-sm text-[var(--pg-text-muted)] flex items-center justify-between">
                <span>Layer 1 · Needs attention queue</span>
                <span className="pg-code-sm">{sampleAnalysis.findings.length} open in sample</span>
              </figcaption>
              <img
                src={`/images/preview/needs-attention-${themeSuffix}-1x.webp`}
                srcSet={`/images/preview/needs-attention-${themeSuffix}-1x.webp 1x, /images/preview/needs-attention-${themeSuffix}-2x.webp 2x`}
                alt="PipelineGuard Needs attention triage queue sorted by severity and age"
                loading="lazy"
                className="block w-full h-auto"
              />
            </figure>

            {/* Layer 1: Open now posture screenshot */}
            <figure className="pg-preview-layer-1 m-0 lg:col-span-5 border border-[var(--pg-line)] rounded-[8px] bg-[var(--pg-panel)] overflow-hidden">
              <figcaption className="px-3 py-2 border-b border-[var(--pg-line)] pg-label-sm text-[var(--pg-text-muted)] flex items-center justify-between">
                <span>Layer 2 · Open now posture</span>
                <Badge severity={featuredFinding?.severity ?? "CRITICAL"} />
              </figcaption>
              <img
                src={`/images/preview/open-now-${themeSuffix}-1x.webp`}
                srcSet={`/images/preview/open-now-${themeSuffix}-1x.webp 1x, /images/preview/open-now-${themeSuffix}-2x.webp 2x`}
                alt="PipelineGuard Open now severity breakdown and pipeline summary"
                loading="lazy"
                className="block w-full h-auto"
              />
            </figure>

            {/* Layer 2: Run risk trend screenshot */}
            <figure className="pg-preview-layer-2 m-0 lg:col-span-12 border border-[var(--pg-line)] rounded-[8px] bg-[var(--pg-panel)] overflow-hidden">
              <figcaption className="px-3 py-2 border-b border-[var(--pg-line)] pg-label-sm text-[var(--pg-text-muted)] flex items-center justify-between">
                <span>Layer 3 · Mean finding risk vs CI gate threshold</span>
                <span className="pg-code-sm">
                  {featuredFinding?.ruleId ?? "PG-WF-001"} · Risk {sampleAnalysis.risk.score}/100 ({sampleAnalysis.risk.grade})
                </span>
              </figcaption>
              <img
                src={`/images/preview/run-risk-${themeSuffix}-1x.webp`}
                srcSet={`/images/preview/run-risk-${themeSuffix}-1x.webp 1x, /images/preview/run-risk-${themeSuffix}-2x.webp 2x`}
                alt="PipelineGuard mean finding risk trend chart plotted against the 70-point CI gate threshold"
                loading="lazy"
                className="block w-full h-auto"
              />
            </figure>
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
                    className={`h-8 px-3 rounded-[8px] pg-label-sm border transition-colors cursor-pointer ${
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
