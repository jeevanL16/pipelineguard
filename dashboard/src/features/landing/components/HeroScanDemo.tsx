import React, { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { analyzeWorkflowText } from "../../../rules/analyzer";
import { HERO_BROKEN_WORKFLOW, HERO_FIXED_WORKFLOW } from "../../../rules/sampleWorkflows";
import { prefersReducedMotion, MOTION } from "../../../motion/motion";
import { setHeroScanState } from "../../../three/state/heroScanStore";
import { Badge, Button, CodePanel, Panel, Seal } from "../../../ui";
import type { CodeLineAnnotation } from "../../../ui/Panel";

async function sha256Hex(text: string): Promise<string | null> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const bytes = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return null;
}

type DemoPhase = "scanning" | "found" | "diffing" | "rescanning" | "fixed";

export function HeroScanDemo() {
  const brokenAnalysis = useMemo(
    () => analyzeWorkflowText(HERO_BROKEN_WORKFLOW, "ci.yml"),
    []
  );
  const brokenFindings = brokenAnalysis.findings;
  const totalLines = useMemo(() => HERO_BROKEN_WORKFLOW.split(/\r?\n/).length, []);

  const [phase, setPhase] = useState<DemoPhase>(() =>
    prefersReducedMotion() ? "found" : "scanning"
  );
  const [scanLine, setScanLine] = useState<number | null>(() =>
    prefersReducedMotion() ? null : 1
  );
  const [revealedCount, setRevealedCount] = useState<number>(() =>
    prefersReducedMotion() ? brokenFindings.length : 0
  );
  const [hoveredFindingId, setHoveredFindingId] = useState<string | null>(null);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [focusedLine, setFocusedLine] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState<string>("");
  const [verifiedSha, setVerifiedSha] = useState<string | null>(null);
  const [fixedCount, setFixedCount] = useState<number>(0);
  const [replayNonce, setReplayNonce] = useState<number>(0);

  const codeContainerRef = useRef<HTMLDivElement | null>(null);

  const buildSummaryAnnouncement = () => {
    const counts = brokenFindings.reduce(
      (acc, f) => {
        const k = f.severity.toLowerCase();
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const parts: string[] = [];
    if (counts.critical) parts.push(`${counts.critical} critical`);
    if (counts.high) parts.push(`${counts.high} high`);
    if (counts.medium) parts.push(`${counts.medium} medium`);
    if (counts.low) parts.push(`${counts.low} low`);
    return `Scan complete: ${brokenFindings.length} findings, ${parts.join(", ")}.`;
  };

  // Run cursor scan once on load (or replay)
  useEffect(() => {
    if (phase !== "scanning") return;

    if (prefersReducedMotion()) {
      setScanLine(null);
      setRevealedCount(brokenFindings.length);
      setPhase("found");
      setAnnouncement(buildSummaryAnnouncement());
      return;
    }

    let cancelled = false;
    let current = 1;
    setScanLine(1);
    setRevealedCount(0);

    const interval = window.setInterval(() => {
      if (cancelled) return;
      const reachedFindings = brokenFindings.filter((f) => (f.line ?? 0) <= current).length;
      setRevealedCount(reachedFindings);

      if (current >= totalLines) {
        window.clearInterval(interval);
        setScanLine(null);
        setRevealedCount(brokenFindings.length);
        setPhase("found");
        setAnnouncement(buildSummaryAnnouncement());
      } else {
        current += 1;
        setScanLine(current);
      }
    }, MOTION.scanLineMs);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [phase, replayNonce, brokenFindings, totalLines]);

  // Publish live scan state into heroScanStore so HeroGateScene stays slaved without independent animation
  useEffect(() => {
    const mappedPhase = phase === "found" || phase === "diffing" ? "done" : phase;
    setHeroScanState({
      phase: mappedPhase,
      scanLine,
      totalLines:
        phase === "rescanning" || phase === "fixed"
          ? HERO_FIXED_WORKFLOW.split(/\r?\n/).length
          : totalLines,
      findings: brokenFindings,
      revealedCount,
      fixedCount,
      digest: verifiedSha,
    });
  }, [phase, scanLine, totalLines, brokenFindings, revealedCount, fixedCount, verifiedSha]);

  const handleShowFix = async () => {
    const digest = await sha256Hex(HERO_FIXED_WORKFLOW);
    const fixedCheck = analyzeWorkflowText(HERO_FIXED_WORKFLOW, "ci.yml");

    if (prefersReducedMotion()) {
      setVerifiedSha(fixedCheck.findings.length === 0 ? digest : null);
      setFixedCount(brokenFindings.length);
      setPhase("fixed");
      setAnnouncement("Fix applied. Re-scan complete: 0 findings.");
      return;
    }

    setFixedCount(0);
    setPhase("diffing");
    window.setTimeout(() => {
      setPhase("rescanning");
      let line = 1;
      const fixedLen = HERO_FIXED_WORKFLOW.split(/\r?\n/).length;
      setScanLine(1);

      let checked = 0;
      let scanDone = false;
      let staggerDone = brokenFindings.length === 0;

      const maybeFinish = () => {
        if (!scanDone || !staggerDone) return;
        setScanLine(null);
        setVerifiedSha(fixedCheck.findings.length === 0 ? digest : null);
        setPhase("fixed");
        setAnnouncement("Fix applied. Re-scan complete: 0 findings.");
      };

      const lineTimer = window.setInterval(() => {
        line += 2;
        if (line > fixedLen) {
          window.clearInterval(lineTimer);
          setScanLine(null);
          scanDone = true;
          maybeFinish();
        } else {
          setScanLine(line);
        }
      }, MOTION.scanLineMs);

      const stepTimer = window.setInterval(() => {
        checked += 1;
        setFixedCount(checked);
        if (checked >= brokenFindings.length) {
          window.clearInterval(stepTimer);
          staggerDone = true;
          maybeFinish();
        }
      }, 50);
    }, MOTION.diffSwapMs);
  };

  const handleRunAgain = () => {
    setVerifiedSha(null);
    setFixedCount(0);
    setFocusedLine(null);
    setHoveredFindingId(null);
    setAnnouncement("");
    setReplayNonce((n) => n + 1);
    setPhase(prefersReducedMotion() ? "found" : "scanning");
  };

  const shownCode =
    phase === "rescanning" || phase === "fixed"
      ? HERO_FIXED_WORKFLOW
      : HERO_BROKEN_WORKFLOW;

  // Compute line annotations matching cursor / diff / fixed state
  const lineAnnotations = useMemo<Record<number, CodeLineAnnotation>>(() => {
    const map: Record<number, CodeLineAnnotation> = {};
    if (phase === "diffing") {
      [3, 5, 10, 12, 13, 14, 15].forEach((ln) => {
        map[ln] = { diff: "removed" };
      });
      return map;
    }
    if (phase === "rescanning" || phase === "fixed") {
      [3, 6, 10, 12, 13, 14, 15, 16].forEach((ln) => {
        map[ln] = { diff: "added" };
      });
      return map;
    }
    // Scanning or found
    brokenFindings.slice(0, revealedCount).forEach((f) => {
      for (const ln of f.relatedLines) {
        if (!map[ln]) {
          map[ln] = { severity: f.severity };
        }
      }
    });
    return map;
  }, [phase, brokenFindings, revealedCount]);

  // Bi-directional hover/focus line highlighting
  const highlightedLines = useMemo(() => {
    const set = new Set<number>();
    if (hoveredFindingId) {
      const f = brokenFindings.find((x) => x.id === hoveredFindingId);
      f?.relatedLines.forEach((l) => set.add(l));
    }
    return set;
  }, [hoveredFindingId, brokenFindings]);

  const visibleFindings = brokenFindings.slice(0, revealedCount);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* Always-dark Code Panel (7 columns from lg up) */}
      <div ref={codeContainerRef} className="lg:col-span-7 min-w-0">
        <CodePanel
          forceDark
          title="Sample workflow: ci.yml"
          headerRight={
            <span className="pg-code-sm text-[var(--pg-text-muted)]">
              {phase === "fixed"
                ? "0 findings"
                : `${brokenFindings.length} findings · Risk ${brokenAnalysis.risk.score}/100`}
            </span>
          }
          code={shownCode}
          activeScanLine={scanLine}
          lineAnnotations={lineAnnotations}
          highlightedLines={highlightedLines}
          focusedLine={focusedLine}
          onLineHover={(ln) => setHoveredLine(ln)}
          onLineSelect={(ln) => setFocusedLine(ln)}
        />
      </div>

      {/* Findings / Verification Panel (5 columns from lg up) */}
      <Panel className="lg:col-span-5 space-y-4">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--pg-line)]">
          <h2 className="pg-headline-sm text-[var(--pg-text)] m-0">Findings</h2>
          <span className="pg-data-md text-[var(--pg-text-muted)]">
            {phase === "scanning" && scanLine
              ? `Scanning line ${scanLine} / ${totalLines}`
              : phase === "rescanning"
              ? "Re-scanning…"
              : phase === "fixed"
              ? "0 remaining"
              : `${visibleFindings.length} of ${brokenFindings.length}`}
          </span>
        </div>

        <ul className="m-0 p-0 list-none space-y-2">
          {(phase === "scanning" ? visibleFindings : brokenFindings).map((f, idx) => {
            const isFixed =
              phase === "fixed" || (phase === "rescanning" && idx < fixedCount);
            const isRelatedToHoveredLine =
              !isFixed && hoveredLine !== null && f.relatedLines.includes(hoveredLine);
            const descId = `hero-line-ref-${f.id}`;

            return (
              <li key={f.id} data-finding-fixed={isFixed ? "true" : "false"}>
                <button
                  type="button"
                  aria-describedby={descId}
                  onMouseEnter={() => setHoveredFindingId(f.id)}
                  onMouseLeave={() => setHoveredFindingId(null)}
                  onFocus={() => setHoveredFindingId(f.id)}
                  onBlur={() => setHoveredFindingId(null)}
                  onClick={() => {
                    if (f.line) {
                      setFocusedLine(f.line);
                      const target = codeContainerRef.current?.querySelector(
                        `[data-line="${f.line}"]`
                      ) as HTMLElement | null;
                      target?.focus();
                    }
                  }}
                  className={`w-full text-left p-2.5 rounded-[8px] border transition-colors duration-120 cursor-pointer ${
                    isRelatedToHoveredLine
                      ? "bg-[var(--pg-raised)] border-[var(--pg-primary)]"
                      : "bg-[var(--pg-canvas)] border-[var(--pg-line)] hover:bg-[var(--pg-raised)]"
                  } pg-surface-enter`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {isFixed ? (
                        <Badge severity="PASS" label="Fixed" />
                      ) : (
                        <Badge severity={f.severity} />
                      )}
                      <span className="pg-code-sm text-[var(--pg-text)] font-medium">
                        {f.ruleId}
                      </span>
                    </div>
                    <span id={descId} className="pg-code-sm text-[var(--pg-text-muted)] shrink-0">
                      L{f.relatedLines.join(", L")}
                    </span>
                  </div>
                  <div className="pg-body-sm text-[var(--pg-text-muted)] mt-1">
                    {isFixed ? f.fixSummary : f.title}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="pt-3 border-t border-[var(--pg-line)] flex flex-wrap items-center justify-between gap-3">
          {phase === "fixed" ? (
            <div className="flex flex-wrap items-center justify-between gap-3 w-full">
              {verifiedSha ? (
                <Seal digest={verifiedSha} label="Verified" animate />
              ) : (
                <Badge severity="PASS" label="0 findings · Pass" />
              )}
              <Button variant="secondary" size="compact" onClick={handleRunAgain}>
                <RotateCcw size={14} strokeWidth={1.5} />
                Run scan again
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="primary"
                size="compact"
                onClick={handleShowFix}
                disabled={phase === "diffing" || phase === "rescanning"}
              >
                Show fix
              </Button>
              <Button
                variant="secondary"
                size="compact"
                onClick={handleRunAgain}
                disabled={phase === "scanning"}
              >
                <RotateCcw size={14} strokeWidth={1.5} />
                Run scan again
              </Button>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
