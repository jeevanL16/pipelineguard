import React, { useMemo, useState } from "react";
import { WORKFLOW_RULES } from "../../../rules/registry";
import type { Severity } from "../../../rules/schemas";
import { runViewTransition } from "../../../motion/motion";
import { Badge, Chip, Panel } from "../../../ui";

const FILTER_SEVERITIES: readonly Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export function RulesCatalogSection() {
  const [selectedSevs, setSelectedSevs] = useState<Severity[]>([]);

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
              {catalogRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-[var(--pg-raised)] transition-colors">
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
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </section>
  );
}
