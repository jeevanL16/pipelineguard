import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Badge, Button } from "../../../ui";
import { useScene3DMode } from "../../../three/core/useScene3DMode";
import { useSectionProgress } from "../../../three/core/useSectionProgress";
import { computeCanonicalDigestHex, computeGateSequenceSummary } from "../../../three/scenes/GateSequence3D/sequenceData";

const GateSequence3D = lazy(() =>
  import("../../../three/scenes/GateSequence3D").then((m) => ({
    default: m.GateSequence3D,
  }))
);

const STEPS = [
  {
    number: "1",
    name: "Connect",
    detail: "Point PipelineGuard at a GitHub repository URL and verify workflow file paths before saving.",
  },
  {
    number: "2",
    name: "Scan",
    detail: "Inspect workflow ASTs for injection, overly broad tokens, mutable action refs, and leaked secrets.",
  },
  {
    number: "3",
    name: "Score",
    detail: "Compute deterministic 0–100 risk scores from rule severity weights, confidence, and trigger exposure.",
  },
  {
    number: "4",
    name: "Record",
    detail: "Log findings, SHA-256 build digests, and every analyst status transition to an immutable audit log.",
  },
] as const;

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const badgeRefs = useRef<Array<HTMLDivElement | null>>([null, null, null, null]);

  const mode = useScene3DMode();
  const progressStore = useSectionProgress(sectionRef, mode);

  const summary = useMemo(() => computeGateSequenceSummary(), []);
  const [digestHex, setDigestHex] = useState<string | null>(null);
  const [replayTrigger, setReplayTrigger] = useState(0);
  const [litStations, setLitStations] = useState<readonly [boolean, boolean, boolean, boolean]>(
    () => (mode === "static" || mode === "fallback" ? [true, true, true, true] : [false, false, false, false])
  );
  const [stationXs, setStationXs] = useState<readonly [number, number, number, number]>([
    -390, -130, 130, 390,
  ]);

  useEffect(() => {
    let active = true;
    computeCanonicalDigestHex(summary.canonicalPayload).then((hex) => {
      if (active) setDigestHex(hex);
    });
    return () => {
      active = false;
    };
  }, [summary.canonicalPayload]);

  // Align 3D station columns horizontally with the 4 DOM number badges
  useEffect(() => {
    const container = sectionRef.current;
    if (!container) return;

    const measure = () => {
      const boxRect = container.getBoundingClientRect();
      if (boxRect.width < 640) return;
      const centerX = boxRect.left + boxRect.width / 2;
      const measured = [0, 1, 2, 3].map((i) => {
        const badge = badgeRefs.current[i];
        if (!badge) return [-390, -130, 130, 390][i];
        const r = badge.getBoundingClientRect();
        return Math.round(r.left + r.width / 2 - centerX);
      }) as [number, number, number, number];
      setStationXs(measured);
    };

    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(container);
    window.addEventListener("resize", measure, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const sequenceFallbackBand = (
    <div className="h-[280px] rounded-[14px] border border-[var(--pg-line)] bg-[var(--pg-panel)] p-5 grid grid-cols-4 gap-4 items-center">
      <div className="space-y-1.5 border-r border-[var(--pg-line)] pr-3">
        <div className="pg-label-sm text-[var(--pg-text-muted)]">Workflow sources</div>
        <div className="pg-headline-sm text-[var(--pg-primary)] pg-tnum">
          {summary.workflowPaths.length} files
        </div>
        <div className="pg-code-sm text-[var(--pg-text-muted)] truncate">
          {summary.workflowPaths[0]}
        </div>
      </div>

      <div className="space-y-1.5 border-r border-[var(--pg-line)] pr-3">
        <div className="pg-label-sm text-[var(--pg-text-muted)]">Parsed AST tree</div>
        <div className="pg-headline-sm text-[var(--pg-text)] pg-tnum">
          {summary.astNodes.length} nodes · {summary.analysis.findings.length} hits
        </div>
        <div className="pg-code-sm text-[var(--pg-critical)]">
          {summary.canonicalFindings[0]?.ruleId ?? "No findings"}
        </div>
      </div>

      <div className="space-y-1.5 border-r border-[var(--pg-line)] pr-3">
        <div className="pg-label-sm text-[var(--pg-text-muted)]">Deterministic score</div>
        <div className="pg-headline-sm text-[var(--pg-critical)] pg-tnum">
          {summary.analysis.risk.score}/100 · Grade {summary.analysis.risk.grade}
        </div>
        <div className="pg-body-sm text-[var(--pg-text-muted)]">
          Gate threshold: {summary.threshold}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="pg-label-sm text-[var(--pg-text-muted)]">Canonical digest</div>
        <div className="pt-0.5">
          <Badge severity="PASS" label="Audit locked" />
        </div>
        <div className="pg-code-sm text-[var(--pg-text)]">
          {digestHex ?? "Web Crypto"}
        </div>
      </div>
    </div>
  );

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="max-w-[40rem] space-y-2">
          <h2 className="pg-headline-lg text-[var(--pg-text)] m-0">
            From repository to audit log
          </h2>
          <p className="pg-body-md text-[var(--pg-text-muted)] m-0">
            Four deterministic stages run on every connected workflow change.
          </p>
        </div>

        {mode === "webgl" && (
          <Button
            variant="ghost"
            size="compact"
            onClick={() => setReplayTrigger((n) => n + 1)}
          >
            <RotateCcw size={14} strokeWidth={1.5} />
            Show sequence again
          </Button>
        )}
      </div>

      {/* Desktop 3D band above the canonical DOM rail (hidden below 768px where DOM rail is fallback) */}
      <div className="hidden md:block">
        {mode === "fallback" ? (
          sequenceFallbackBand
        ) : (
          <Suspense fallback={sequenceFallbackBand}>
            <GateSequence3D
              fallback={sequenceFallbackBand}
              overlay={
                <div className="pointer-events-none absolute inset-x-0 bottom-3 grid grid-cols-4 px-2 pg-label-sm text-[var(--pg-text-muted)]">
                  <div className="text-center pg-code-sm">
                    {summary.workflowPaths.length} workflow files
                  </div>
                  <div className="text-center pg-code-sm">
                    {summary.astNodes.length} AST nodes · {summary.analysis.findings.length} hits
                  </div>
                  <div className="text-center pg-code-sm">
                    {summary.analysis.risk.score}/100 ({summary.analysis.risk.grade}) · gate{" "}
                    {summary.threshold}
                  </div>
                  <div className="text-center pg-code-sm">
                    {digestHex ? `sha256:${digestHex}` : "Audit locked"}
                  </div>
                </div>
              }
              stationScreenXs={stationXs}
              summary={summary}
              mode={mode}
              progressStore={progressStore}
              replayTrigger={replayTrigger}
              onStationStatesChange={setLitStations}
            />
          </Suspense>
        )}
      </div>

      <div className="relative">
        {/* Horizontal gate line on md+, vertical line on mobile */}
        <div
          aria-hidden="true"
          className="hidden md:block absolute top-4 left-4 right-4 h-[2px] bg-[var(--pg-line)]"
        >
          <div className="pg-gate-line h-full w-full bg-[var(--pg-primary)]" />
        </div>
        <div
          aria-hidden="true"
          className="md:hidden absolute top-4 bottom-4 left-4 w-[2px] bg-[var(--pg-line)]"
        >
          <div className="pg-gate-line h-full w-full bg-[var(--pg-primary)]" />
        </div>

        <ol className="relative m-0 p-0 list-none grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-6">
          {STEPS.map((step, idx) => {
            const isLit = mode === "fallback" || mode === "static" || litStations[idx];
            return (
              <li key={step.number} className="flex md:block items-start gap-4">
                <div
                  ref={(el) => {
                    badgeRefs.current[idx] = el;
                  }}
                  data-lit={isLit ? "true" : "false"}
                  className={`relative z-10 w-8 h-8 rounded-[4px] border pg-data-md flex items-center justify-center shrink-0 transition-colors duration-120 ${
                    isLit
                      ? "border-[var(--pg-primary)] bg-[var(--pg-raised)] text-[var(--pg-primary)]"
                      : "border-[var(--pg-line-strong)] bg-[var(--pg-panel)] text-[var(--pg-text-muted)]"
                  }`}
                >
                  {step.number}
                </div>
                <div className="md:mt-4 space-y-1.5">
                  <h3 className="pg-headline-sm text-[var(--pg-text)] m-0">{step.name}</h3>
                  <p className="pg-body-sm text-[var(--pg-text-muted)] m-0">{step.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
