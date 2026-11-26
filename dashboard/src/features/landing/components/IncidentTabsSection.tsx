import React, { Suspense, lazy, useState } from "react";
import { Badge, CodePanel, Panel, Tabs, type TabItem } from "../../../ui";
import { useScene3DMode } from "../../../three/core/useScene3DMode";
import { INCIDENT_PATHS, type IncidentPathSpec } from "./incidentPaths";

const AttackPath3D = lazy(() =>
  import("../../../three/scenes/AttackPath3D").then((m) => ({
    default: m.AttackPath3D,
  }))
);

const INCIDENT_TABS: readonly TabItem[] = [
  {
    value: "unpinned-action",
    label: "Mutable action tag",
    content: (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-3">
          <Badge severity="HIGH" />
          <h3 className="pg-headline-sm text-[var(--pg-text)] m-0">
            A third-party action moves under a floating tag
          </h3>
          <p className="pg-body-sm text-[var(--pg-text-muted)] m-0">
            Pinning to <span className="pg-code-sm">@v3</span> lets upstream maintainers retarget the tag to compromised code after you reviewed it. Rule <span className="pg-code-sm text-[var(--pg-text)]">PG-WF-019</span> requires an immutable 40-character commit SHA.
          </p>
        </div>
        <div className="lg:col-span-7">
          <CodePanel
            forceDark
            title=".github/workflows/deploy.yml"
            code={`- uses: vendor/deploy-action@v3\n- uses: vendor/deploy-action@0123456789abcdef0123456789abcdef01234567 # v3`}
            lineAnnotations={{
              1: { diff: "removed" },
              2: { diff: "added" },
            }}
          />
        </div>
      </div>
    ),
  },
  {
    value: "exposed-secret",
    label: "Secret written to logs",
    content: (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-3">
          <Badge severity="HIGH" />
          <h3 className="pg-headline-sm text-[var(--pg-text)] m-0">
            A secret expression is printed inside a shell step
          </h3>
          <p className="pg-body-sm text-[var(--pg-text-muted)] m-0">
            Interpolating secrets into <span className="pg-code-sm">echo</span> or shell trace output exposes credentials in logs and downstream artifacts. Flagged by <span className="pg-code-sm text-[var(--pg-text)]">PG-WF-021</span> and secret scanning.
          </p>
        </div>
        <div className="lg:col-span-7">
          <CodePanel
            forceDark
            title=".github/workflows/publish.yml"
            code={`- run: echo "token=\${{ secrets.NPM_TOKEN }}"\n- run: npm publish --access public\n  env:\n    NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}`}
            lineAnnotations={{
              1: { severity: "HIGH" },
              2: { diff: "added" },
              3: { diff: "added" },
              4: { diff: "added" },
            }}
          />
        </div>
      </div>
    ),
  },
  {
    value: "tampered-artifact",
    label: "Tampered artifact digest",
    content: (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-3">
          <Badge severity="CRITICAL" />
          <h3 className="pg-headline-sm text-[var(--pg-text)] m-0">
            Published artifact does not match the built digest
          </h3>
          <p className="pg-body-sm text-[var(--pg-text-muted)] m-0">
            PipelineGuard compares the SHA-256 of the produced binary against the expected digest stored outside the build directory and blocks promotion on mismatch.
          </p>
        </div>
        <Panel className="lg:col-span-7 space-y-3 pg-force-dark">
          <div className="flex items-center justify-between gap-3 py-2 border-b border-[var(--pg-line)]">
            <span className="pg-body-sm text-[var(--pg-text-muted)]">Built in CI runner</span>
            <span className="pg-code-sm text-[var(--pg-pass)]">9f2c41ab07de</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-2 border-b border-[var(--pg-line)]">
            <span className="pg-body-sm text-[var(--pg-text-muted)]">Published package</span>
            <span className="pg-code-sm text-[var(--pg-critical)]">4d80e2c91a3f</span>
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="pg-label-sm text-[var(--pg-text-muted)]">Decision</span>
            <Badge severity="CRITICAL" label="Mismatch blocked" />
          </div>
        </Panel>
      </div>
    ),
  },
];

export function IncidentTabsSection() {
  const [activeTab, setActiveTab] = useState<string>(INCIDENT_PATHS[0].id);
  const [guardEnabled, setGuardEnabled] = useState<boolean>(false);
  const sceneMode = useScene3DMode();

  const currentPath: IncidentPathSpec =
    INCIDENT_PATHS.find((p) => p.id === activeTab) ?? INCIDENT_PATHS[0];

  const pathFallbackBand = (
    <div className="h-[190px] rounded-[8px] border border-[var(--pg-line)] bg-[var(--pg-canvas)] p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2">
        <span className="pg-label-sm text-[var(--pg-text-muted)]">
          {currentPath.tabLabel} propagation path
        </span>
        {guardEnabled ? (
          <Badge severity="PASS" label={currentPath.gateActionLabel} />
        ) : (
          <Badge severity={currentPath.severity} label="Without guard" />
        )}
      </div>

      <div className="grid grid-cols-4 gap-3 items-center">
        {currentPath.nodes.map((node, idx) => {
          const blockedAfter = guardEnabled && idx > 1;
          const haltedHere = guardEnabled && node.isGatePoint;
          const reachedTerminal = !guardEnabled && node.isTerminal;
          return (
            <div
              key={node.id}
              className={`p-2.5 rounded-[8px] border pg-label-sm ${
                haltedHere
                  ? "border-[var(--pg-primary)] bg-[var(--pg-pass-tint)] text-[var(--pg-pass)]"
                  : reachedTerminal
                  ? "border-[var(--pg-critical)] bg-[var(--pg-critical-tint)] text-[var(--pg-critical)]"
                  : blockedAfter
                  ? "border-[var(--pg-line)] bg-[var(--pg-panel)] text-[var(--pg-text-muted)] opacity-55"
                  : "border-[var(--pg-line-strong)] bg-[var(--pg-panel)] text-[var(--pg-text)]"
              }`}
            >
              <div>{node.label}</div>
              {node.isGatePoint && (
                <div className="pg-code-sm text-[11px] mt-0.5 text-[var(--pg-primary)]">
                  {currentPath.ruleId}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pg-body-sm text-[var(--pg-text-muted)]">
        {guardEnabled
          ? `Blocked at control point (${currentPath.ruleId}).`
          : currentPath.compromisedOutcome}
      </div>
    </div>
  );

  return (
    <section id="incidents" className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="max-w-[40rem] space-y-2">
          <h2 className="pg-headline-lg text-[var(--pg-text)] m-0">
            How pipelines get compromised
          </h2>
          <p className="pg-body-md text-[var(--pg-text-muted)] m-0">
            Each attack stage leaves verifiable evidence in workflow files, logs, or digests.
          </p>
        </div>

        <div
          role="group"
          aria-label="Incident gate simulation mode"
          className="inline-flex items-center rounded-[8px] border border-[var(--pg-line)] bg-[var(--pg-panel)] p-0.5 self-start"
        >
          <button
            type="button"
            aria-pressed={!guardEnabled}
            onClick={() => setGuardEnabled(false)}
            className={`h-7 px-3 rounded-[4px] pg-label-sm cursor-pointer transition-colors duration-120 ${
              !guardEnabled
                ? "bg-[var(--pg-raised)] text-[var(--pg-text)]"
                : "text-[var(--pg-text-muted)] hover:text-[var(--pg-text)]"
            }`}
          >
            Without guard
          </button>
          <button
            type="button"
            aria-pressed={guardEnabled}
            onClick={() => setGuardEnabled(true)}
            className={`h-7 px-3 rounded-[4px] pg-label-sm cursor-pointer transition-colors duration-120 ${
              guardEnabled
                ? "bg-[var(--pg-raised)] text-[var(--pg-primary)]"
                : "text-[var(--pg-text-muted)] hover:text-[var(--pg-text)]"
            }`}
          >
            With guard
          </button>
        </div>
      </div>

      <Panel className="space-y-5">
        <div className="hidden md:block">
          {sceneMode === "fallback" ? (
            pathFallbackBand
          ) : (
            <Suspense fallback={pathFallbackBand}>
              <AttackPath3D
                pathSpec={currentPath}
                guardEnabled={guardEnabled}
                mode={sceneMode}
                fallback={pathFallbackBand}
              />
            </Suspense>
          )}
        </div>

        <Tabs
          items={INCIDENT_PATHS.map((p, idx) => ({
            ...INCIDENT_TABS[idx],
            value: p.id,
            label: p.tabLabel,
          }))}
          value={activeTab}
          onValueChange={setActiveTab}
        />

        {/* Hidden semantic step list mirroring incidentPaths.ts */}
        <ol aria-label="Compromise chain stages" className="sr-only">
          {currentPath.nodes.map((node) => (
            <li key={node.id}>
              {node.label}
              {node.isGatePoint ? ` — gate rule ${currentPath.ruleId}` : ""}
            </li>
          ))}
        </ol>
      </Panel>
    </section>
  );
}
