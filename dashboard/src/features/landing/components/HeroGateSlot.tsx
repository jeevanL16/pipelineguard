import React, { Suspense, lazy, useEffect, useState } from "react";
import { Badge } from "../../../ui";
import { useScene3DMode } from "../../../three/core/useScene3DMode";
import { useHeroScanStore } from "../../../three/state/heroScanStore";

const HeroGateScene = lazy(() =>
  import("../../../three/scenes/HeroGateScene").then((m) => ({
    default: m.HeroGateScene,
  }))
);

/**
 * Fixed-height (240px) desktop slot beside the hero headline (lg and up).
 * Never mounts before the window `load` event + idle callback (with Safari fallback) so LCP is untouched.
 */
export function HeroGateSlot() {
  const mode = useScene3DMode();
  const snapshot = useHeroScanStore();
  const [idleReady, setIdleReady] = useState(false);

  useEffect(() => {
    if (mode === "fallback") return;

    let cancelled = false;
    let timerId: number | undefined;
    let idleId: number | undefined;

    const scheduleIdleMount = () => {
      if (cancelled) return;
      const win = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      if (typeof win.requestIdleCallback === "function") {
        idleId = win.requestIdleCallback(
          () => {
            if (!cancelled) setIdleReady(true);
          },
          { timeout: 1500 }
        );
      } else {
        timerId = window.setTimeout(() => {
          if (!cancelled) setIdleReady(true);
        }, 1500);
      }
    };

    if (document.readyState === "complete") {
      scheduleIdleMount();
    } else {
      window.addEventListener("load", scheduleIdleMount, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", scheduleIdleMount);
      if (timerId !== undefined) window.clearTimeout(timerId);
      const win = window as Window & { cancelIdleCallback?: (id: number) => void };
      if (idleId !== undefined && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idleId);
      }
    };
  }, [mode]);

  const fallbackGateCard = (
    <div
      className="h-[240px] rounded-[14px] border border-[var(--pg-line)] bg-[var(--pg-panel)] p-4 flex flex-col justify-between"
      role="status"
      aria-label="Live gate status summary"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--pg-line)] pb-2.5">
        <span className="pg-label-sm text-[var(--pg-text-muted)]">Gate state</span>
        {snapshot.phase === "fixed" ? (
          <Badge severity="PASS" label="Gate open · Pass" />
        ) : (
          <Badge
            severity={snapshot.findings.length > 0 ? "CRITICAL" : "INFO"}
            label={
              snapshot.phase === "scanning"
                ? `Scanning line ${snapshot.scanLine ?? 1}`
                : `${snapshot.findings.length} checks flagged`
            }
          />
        )}
      </div>

      <div className="space-y-1.5">
        {snapshot.findings.map((f, idx) => {
          const isFixed =
            snapshot.phase === "fixed" ||
            (snapshot.phase === "rescanning" && idx < snapshot.fixedCount);
          const isHit =
            snapshot.phase === "done" ||
            (snapshot.phase === "rescanning" && !isFixed) ||
            (snapshot.phase === "scanning" && idx < snapshot.revealedCount);
          return (
            <div key={f.id} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="pg-code-sm text-[var(--pg-text-muted)] truncate">
                {f.ruleId}
              </span>
              <span
                className="h-1.5 w-20 rounded-[4px] transition-colors duration-120"
                style={{
                  backgroundColor: isFixed
                    ? "var(--pg-pass)"
                    : isHit
                    ? f.severity === "CRITICAL"
                      ? "var(--pg-critical)"
                      : f.severity === "HIGH"
                      ? "var(--pg-high)"
                      : "var(--pg-low)"
                    : "var(--pg-raised)",
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-[var(--pg-line)] flex items-center justify-between pg-code-sm text-[var(--pg-text-muted)]">
        <span>{snapshot.findings.length} tiles</span>
        <span>
          {snapshot.phase === "fixed" && snapshot.digest
            ? snapshot.digest.slice(0, 12)
            : `${snapshot.fixedCount}/${snapshot.findings.length} cleared`}
        </span>
      </div>
    </div>
  );

  return (
    <div className="hidden lg:block lg:col-span-4 h-[240px]">
      {mode === "fallback" || !idleReady ? (
        fallbackGateCard
      ) : (
        <Suspense fallback={fallbackGateCard}>
          <HeroGateScene mode={mode} fallback={fallbackGateCard} />
        </Suspense>
      )}
    </div>
  );
}
