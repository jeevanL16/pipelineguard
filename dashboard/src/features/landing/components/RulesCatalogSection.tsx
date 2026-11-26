import React, { Suspense, lazy, useMemo, useRef, useState } from "react";
import { WORKFLOW_RULES } from "../../../rules/registry";
import type { Severity } from "../../../rules/schemas";
import { prefersReducedMotion, runViewTransition } from "../../../motion/motion";
import { useScene3DMode } from "../../../three/core/useScene3DMode";
import { Badge, Chip, Panel } from "../../../ui";

const RuleCatalog3D = lazy(() =>
  import("../../../three/scenes/RuleCatalog3D").then((m) => ({
    default: m.RuleCatalog3D,
  }))
);

const FILTER_SEVERITIES: readonly Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export function RulesCatalogSection() {
  const [selectedSevs, setSelectedSevs] = useState<Severity[]>([]);
  const [hoveredRuleId, setHoveredRuleId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const sceneMode = useScene3DMode();

  const toggleSeverity = (sev: Severity) => {
    runViewTransition(() => {
      setSelectedSevs((prev) =>
        prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev]
      );
    });
  };

  const allActiveRules = useMemo(
    () => WORKFLOW_RULES.filter((r) => r.category !== "system"),
    []
  );

  const catalogRules = useMemo(() => {
    if (selectedSevs.length === 0) return allActiveRules;
    return allActiveRules.filter((r) => selectedSevs.includes(r.severity));
  }, [allActiveRules, selectedSevs]);

  const activeRule = hoveredRuleId
    ? allActiveRules.find((r) => r.id === hoveredRuleId) ?? null
    : null;

  const jumpToRuleRow = (ruleId: string) => {
    if (selectedSevs.length > 0) {
      const targetRule = allActiveRules.find((r) => r.id === ruleId);
      if (targetRule && !selectedSevs.includes(targetRule.severity)) {
        setSelectedSevs([]);
      }
    }
    requestAnimationFrame(() => {
      const row = rowRefs.current[ruleId];
      if (!row) return;
      row.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "nearest",
      });
      row.focus();
      setHoveredRuleId(ruleId);
    });
  };

  const catalogFallbackBand = (
    <div className="h-[180px] rounded-[14px] border border-[var(--pg-line)] bg-[var(--pg-panel)] p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between pg-label-sm text-[var(--pg-text-muted)]">
        <span>Severity weight distribution ({allActiveRules.length} rules)</span>
        <span>Click any bar to inspect row</span>
      </div>
      <div className="flex items-end gap-1.5 h-[108px] pt-2">
        {allActiveRules.map((r) => {
          const matches = selectedSevs.length === 0 || selectedSevs.includes(r.severity);
          const heightPct =
            r.severity === "CRITICAL"
              ? 100
              : r.severity === "HIGH"
              ? 68
              : r.severity === "MEDIUM"
              ? 44
              : 24;
          const colorVar =
            r.severity === "CRITICAL"
              ? "var(--pg-critical)"
              : r.severity === "HIGH"
              ? "var(--pg-high)"
              : r.severity === "MEDIUM"
              ? "var(--pg-medium)"
              : "var(--pg-low)";
          return (
            <button
              key={r.id}
              type="button"
              aria-label={`${r.id}: ${r.title}`}
              onMouseEnter={() => setHoveredRuleId(r.id)}
              onMouseLeave={() => setHoveredRuleId(null)}
              onClick={() => jumpToRuleRow(r.id)}
              className="flex-1 rounded-[4px] border border-[var(--pg-line)] cursor-pointer transition-[height,background-color,opacity] duration-120"
              style={{
                height: `${matches ? heightPct : Math.round(heightPct * 0.25)}%`,
                backgroundColor: matches ? colorVar : "var(--pg-raised)",
                opacity: matches ? 1 : 0.45,
              }}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <section id="rules" className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="max-w-[40rem] space-y-2">
          <h2 className="pg-headline-lg text-[var(--pg-text)] m-0">
            Workflow rules catalog
          </h2>
          <p className="pg-body-md text-[var(--pg-text-muted)] m-0">
            All {allActiveRules.length} active workflow checks generated directly from the rule registry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter rules by severity">
          {FILTER_SEVERITIES.map((sev) => (
            <Chip
              key={sev}
              selected={selectedSevs.includes(sev)}
              onClick={() => toggleSeverity(sev)}
            >
              {sev.charAt(0) + sev.slice(1).toLowerCase()}
            </Chip>
          ))}
        </div>
      </div>

      {/* Desktop 3D / Weight Band synchronized with filter chips and table */}
      <div className="hidden md:block space-y-2">
        {sceneMode === "fallback" ? (
          catalogFallbackBand
        ) : (
          <Suspense fallback={catalogFallbackBand}>
            <RuleCatalog3D
              rules={allActiveRules}
              selectedSevs={selectedSevs}
              activeRuleId={hoveredRuleId}
              mode={sceneMode}
              onHoverRule={setHoveredRuleId}
              onJumpToRule={jumpToRuleRow}
              fallback={catalogFallbackBand}
            />
          </Suspense>
        )}

        <div className="px-3 py-2 rounded-[8px] border border-[var(--pg-line)] bg-[var(--pg-panel)] pg-body-sm flex items-center justify-between gap-3">
          {activeRule ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <span className="pg-code-sm text-[var(--pg-primary)] shrink-0">{activeRule.id}</span>
                <Badge severity={activeRule.severity} />
                <span className="text-[var(--pg-text)] truncate">{activeRule.title}</span>
              </div>
              <span className="pg-code-sm text-[var(--pg-text-muted)] shrink-0">{activeRule.cwe}</span>
            </>
          ) : (
            <span className="text-[var(--pg-text-muted)]">
              Hover or select any rule block above to inspect its check and highlight its row below.
            </span>
          )}
        </div>
      </div>

      <Panel padding="none" className="overflow-hidden">
        <div className="overflow-x-auto max-h-[460px]">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-[var(--pg-panel)] border-b border-[var(--pg-line)]">
              <tr>
                <th className="py-2.5 px-4 pg-label-sm text-[var(--pg-text-muted)]">ID</th>
                <th className="py-2.5 px-4 pg-label-sm text-[var(--pg-text-muted)]">Rule</th>
                <th className="py-2.5 px-4 pg-label-sm text-[var(--pg-text-muted)]">Severity</th>
                <th className="py-2.5 px-4 pg-label-sm text-[var(--pg-text-muted)]">Example trigger</th>
                <th className="py-2.5 px-4 pg-label-sm text-[var(--pg-text-muted)]">Fix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--pg-line)]">
              {catalogRules.map((rule) => {
                const highlighted = hoveredRuleId === rule.id;
                return (
                  <tr
                    key={rule.id}
                    ref={(el) => {
                      rowRefs.current[rule.id] = el;
                    }}
                    tabIndex={-1}
                    data-rule-id={rule.id}
                    data-highlighted={highlighted ? "true" : "false"}
                    onMouseEnter={() => setHoveredRuleId(rule.id)}
                    onMouseLeave={() => setHoveredRuleId(null)}
                    className={`transition-colors outline-none ${
                      highlighted ? "bg-[var(--pg-raised)]" : "hover:bg-[var(--pg-raised)]"
                    }`}
                  >
                    <td className="py-2.5 px-4 pg-code-sm text-[var(--pg-text)] whitespace-nowrap align-top">
                      <div>{rule.id}</div>
                      <div className="text-[11px] text-[var(--pg-text-muted)]">{rule.cwe}</div>
                    </td>
                    <td className="py-2.5 px-4 pg-body-sm text-[var(--pg-text)] align-top min-w-[220px]">
                      {rule.title}
                    </td>
                    <td className="py-2.5 px-4 align-top whitespace-nowrap">
                      <Badge severity={rule.severity} />
                    </td>
                    <td className="py-2.5 px-4 pg-code-sm text-[var(--pg-text-muted)] align-top max-w-[280px] break-words">
                      {rule.example}
                    </td>
                    <td className="py-2.5 px-4 pg-body-sm text-[var(--pg-text-muted)] align-top min-w-[200px]">
                      {rule.fixSummary}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </section>
  );
}
