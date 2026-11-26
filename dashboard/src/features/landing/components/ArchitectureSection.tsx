import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Route } from "lucide-react";
import { Button, Panel } from "../../../ui";
import { useScene3DMode } from "../../../three/core/useScene3DMode";
import {
  ARCH_EDGES,
  ARCH_NODES,
  LAYER_NAMES,
  getArchNode,
  getConnectedNodeAndEdgeSet,
  getTraceSets,
} from "../../../three/scenes/ArchitectureFlow3D/graph";

const ArchitectureFlow3D = lazy(() =>
  import("../../../three/scenes/ArchitectureFlow3D").then((m) => ({
    default: m.ArchitectureFlow3D,
  }))
);

type ViewMode = "isometric" | "flat";

export function ArchitectureSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const sceneMode = useScene3DMode();
  const [inView, setInView] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined" && window.location.hash === "#architecture-flat") {
      return "flat";
    }
    return "isometric";
  });
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [tracingFinding, setTracingFinding] = useState(false);
  const [replayNonce, setReplayNonce] = useState(0);

  useEffect(() => {
    const syncHash = () => {
      if (window.location.hash === "#architecture-flat") setViewMode("flat");
      else if (window.location.hash === "#architecture") setViewMode("isometric");
    };
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true);
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const switchView = (next: ViewMode) => {
    setViewMode(next);
    if (typeof window !== "undefined") {
      const nextHash = next === "flat" ? "#architecture-flat" : "#architecture";
      window.history.replaceState(null, "", nextHash);
    }
  };

  const activeNode = activeNodeId ? getArchNode(activeNodeId) : null;
  const connected = useMemo(
    () => getConnectedNodeAndEdgeSet(activeNodeId),
    [activeNodeId]
  );
  const traceSets = useMemo(() => getTraceSets(), []);

  const flatArchitectureFallback = (
    <Panel padding="md" className="overflow-x-auto">
      <div className="min-w-[820px] grid grid-cols-7 gap-3">
        {LAYER_NAMES.map((layerName, layerIdx) => {
          const layerNodes = ARCH_NODES.filter((n) => n.layer === layerIdx).sort(
            (a, b) => a.row - b.row
          );
          return (
            <div key={layerName} className="space-y-2">
              <div className="pg-label-sm text-[var(--pg-text-muted)] pb-1 border-b border-[var(--pg-line)]">
                {layerName}
              </div>
              <div className="space-y-2 pt-1">
                {layerNodes.map((node) => {
                  const isFocused = activeNodeId === node.id;
                  const isNeighbor = connected.nodeIds.has(node.id);
                  const isTrace = tracingFinding && traceSets.nodeIds.has(node.id);
                  const dimmed =
                    (activeNodeId !== null && !isNeighbor) ||
                    (tracingFinding && !isTrace);
                  const countVal = node.count?.();

                  return (
                    <button
                      key={node.id}
                      type="button"
                      aria-pressed={isFocused}
                      onMouseEnter={() => setActiveNodeId(node.id)}
                      onMouseLeave={() => setActiveNodeId(null)}
                      onFocus={() => setActiveNodeId(node.id)}
                      onBlur={() => setActiveNodeId(null)}
                      onClick={() => setActiveNodeId(isFocused ? null : node.id)}
                      className={`w-full text-left p-2.5 rounded-[8px] border transition-colors duration-120 cursor-pointer ${
                        isFocused || isNeighbor
                          ? "border-[var(--pg-primary)] bg-[var(--pg-raised)] text-[var(--pg-text)]"
                          : isTrace
                          ? "border-[var(--pg-critical)] bg-[var(--pg-critical-tint)] text-[var(--pg-text)]"
                          : dimmed
                          ? "border-[var(--pg-line)] bg-[var(--pg-canvas)] text-[var(--pg-text-muted)] opacity-60"
                          : "border-[var(--pg-line-strong)] bg-[var(--pg-canvas)] text-[var(--pg-text)] hover:border-[var(--pg-primary)]"
                      }`}
                    >
                      <div className="pg-label-sm text-[var(--pg-text)]">{node.label}</div>
                      {typeof countVal === "number" && (
                        <div className="pg-code-sm text-[var(--pg-primary)] mt-1">
                          {countVal}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {tracingFinding && (
        <div className="mt-4 pt-3 border-t border-[var(--pg-line)] flex flex-wrap items-center gap-2 pg-code-sm text-[var(--pg-critical)]">
          <span>Trace path:</span>
          {ARCH_EDGES.filter((e) => e.trace).map((edge, idx) => (
            <span key={`${edge.from}-${edge.to}`}>
              {idx > 0 ? " → " : ""}
              {getArchNode(edge.from)?.label}
              {edge.to === "surface-dashboard" || edge.to === "surface-ci-gate"
                ? ` → ${getArchNode(edge.to)?.label}`
                : ""}
            </span>
          ))}
        </div>
      )}
    </Panel>
  );

  const show3dCanvas = sceneMode !== "fallback" && viewMode === "isometric";

  return (
    <section
      ref={sectionRef}
      id="architecture"
      className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-6"
    >
      <span id="architecture-flat" className="sr-only" aria-hidden="true" />

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="max-w-[40rem] space-y-2">
          <h2 className="pg-headline-lg text-[var(--pg-text)] m-0">
            How detection connects to triage
          </h2>
          <p className="pg-body-md text-[var(--pg-text-muted)] m-0">
            Seven deterministic stages route parsed YAML, secrets, and artifact digests into scored findings and enforced gates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={tracingFinding ? "primary" : "secondary"}
            size="compact"
            aria-pressed={tracingFinding}
            onClick={() => setTracingFinding((v) => !v)}
          >
            <Route size={14} strokeWidth={1.5} />
            {tracingFinding ? "Clear trace" : "Trace a finding"}
          </Button>

          {show3dCanvas && sceneMode === "webgl" && (
            <Button
              variant="ghost"
              size="compact"
              onClick={() => setReplayNonce((n) => n + 1)}
            >
              <RotateCcw size={14} strokeWidth={1.5} />
              Show flow again
            </Button>
          )}

          {sceneMode !== "fallback" && (
            <div
              role="group"
              aria-label="Architecture view mode"
              className="inline-flex items-center rounded-[8px] border border-[var(--pg-line)] bg-[var(--pg-panel)] p-0.5"
            >
              {(["isometric", "flat"] as const).map((vm) => (
                <button
                  key={vm}
                  type="button"
                  aria-pressed={viewMode === vm}
                  onClick={() => switchView(vm)}
                  className={`h-7 px-2.5 rounded-[4px] pg-label-sm capitalize cursor-pointer transition-colors duration-120 ${
                    viewMode === vm
                      ? "bg-[var(--pg-raised)] text-[var(--pg-text)]"
                      : "text-[var(--pg-text-muted)] hover:text-[var(--pg-text)]"
                  }`}
                >
                  {vm}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {show3dCanvas ? (
        <Suspense fallback={flatArchitectureFallback}>
          <ArchitectureFlow3D
            mode={sceneMode}
            fallback={flatArchitectureFallback}
            activeNodeId={activeNodeId}
            onSelectNode={setActiveNodeId}
            tracingFinding={tracingFinding}
            replayNonce={replayNonce}
            inView={inView}
          />
        </Suspense>
      ) : (
        flatArchitectureFallback
      )}

      {/* Synchronized role & count inspector + accessible screen-reader list driving exact same highlight */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 rounded-[8px] border border-[var(--pg-line)] bg-[var(--pg-panel)] pg-body-sm">
        {activeNode ? (
          <>
            <div>
              <span className="pg-label-md text-[var(--pg-primary)]">{activeNode.label}:</span>{" "}
              <span className="text-[var(--pg-text)]">{activeNode.role}</span>
            </div>
            {typeof activeNode.count?.() === "number" && (
              <span className="pg-code-sm text-[var(--pg-text-muted)] shrink-0">
                Configured value: {activeNode.count()}
              </span>
            )}
          </>
        ) : (
          <span className="text-[var(--pg-text-muted)]">
            Focus or hover any stage node to inspect connected inputs, outputs, and rule counts.
          </span>
        )}
      </div>

      {/* Visually hidden semantic list mirroring graph.ts for assistive technology */}
      <ul aria-label="Architecture pipeline stages" className="sr-only">
        {ARCH_NODES.map((node) => {
          const countVal = node.count?.();
          return (
            <li key={`sr-${node.id}`}>
              <button
                type="button"
                onFocus={() => setActiveNodeId(node.id)}
                onBlur={() => setActiveNodeId(null)}
                onClick={() => setActiveNodeId((cur) => (cur === node.id ? null : node.id))}
              >
                Layer {node.layer + 1} ({LAYER_NAMES[node.layer]}): {node.label}
                {typeof countVal === "number" ? ` (${countVal})` : ""} — {node.role}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
