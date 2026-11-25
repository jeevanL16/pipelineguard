import React, { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { WORKFLOW_RULES } from "../../rules/registry";
import type { RuleCategory, Severity } from "../../rules/schemas";
import { runViewTransition } from "../../motion/motion";
import { Badge, Button, Chip, Panel } from "../../ui";

const SEVERITIES: readonly Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const CATEGORIES: readonly { key: RuleCategory; label: string }[] = [
  { key: "injection", label: "Injection" },
  { key: "permissions", label: "Permissions" },
  { key: "commands", label: "Commands" },
  { key: "network", label: "Network" },
  { key: "modification", label: "Persistence" },
  { key: "supply_chain", label: "Supply chain" },
];

export function WorkflowsPage() {
  const [selectedSevs, setSelectedSevs] = useState<Severity[]>([]);
  const [selectedCats, setSelectedCats] = useState<RuleCategory[]>([]);

  const toggleSev = (sev: Severity) => {
    runViewTransition(() => {
      setSelectedSevs((p) => (p.includes(sev) ? p.filter((x) => x !== sev) : [...p, sev]));
    });
  };

  const toggleCat = (cat: RuleCategory) => {
    runViewTransition(() => {
      setSelectedCats((p) => (p.includes(cat) ? p.filter((x) => x !== cat) : [...p, cat]));
    });
  };

  const rules = useMemo(() => {
    return WORKFLOW_RULES.filter((r) => r.category !== "system").filter((r) => {
      const sevOk = selectedSevs.length === 0 || selectedSevs.includes(r.severity);
      const catOk = selectedCats.length === 0 || selectedCats.includes(r.category);
      return sevOk && catOk;
    });
  }, [selectedSevs, selectedCats]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="pg-body-sm text-[var(--pg-text-muted)] m-0 max-w-[40rem]">
          Deterministic AST and pattern inspection rules from{" "}
          <span className="pg-code-sm text-[var(--pg-text)]">security/workflow/rules.py</span>.
        </p>
        <NavLink to="/#playground" className="no-underline">
          <Button variant="secondary" size="compact">
            Test YAML in Playground
          </Button>
        </NavLink>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by severity">
          <span className="pg-label-sm text-[var(--pg-text-muted)] mr-1">Severity</span>
          {SEVERITIES.map((sev) => (
            <Chip
              key={sev}
              selected={selectedSevs.includes(sev)}
              onClick={() => toggleSev(sev)}
            >
              {sev.charAt(0) + sev.slice(1).toLowerCase()}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by category">
          <span className="pg-label-sm text-[var(--pg-text-muted)] mr-1">Category</span>
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat.key}
              selected={selectedCats.includes(cat.key)}
              onClick={() => toggleCat(cat.key)}
            >
              {cat.label}
            </Chip>
          ))}
        </div>
      </div>

      <Panel padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-[var(--pg-panel)] border-b border-[var(--pg-line)]">
              <tr>
                <th className="py-2.5 px-4 pg-label-sm text-[var(--pg-text-muted)]">Rule ID</th>
                <th className="py-2.5 px-4 pg-label-sm text-[var(--pg-text-muted)]">Severity</th>
                <th className="py-2.5 px-4 pg-label-sm text-[var(--pg-text-muted)]">Action</th>
                <th className="py-2.5 px-4 pg-label-sm text-[var(--pg-text-muted)]">Check</th>
                <th className="py-2.5 px-4 pg-label-sm text-[var(--pg-text-muted)]">Remediation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--pg-line)]">
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-[var(--pg-raised)] transition-colors">
                  <td className="py-3 px-4 pg-code-sm text-[var(--pg-text)] whitespace-nowrap align-top">
                    <div>{r.id}</div>
                    <div className="text-[11px] text-[var(--pg-text-muted)]">{r.cwe}</div>
                  </td>
                  <td className="py-3 px-4 align-top whitespace-nowrap">
                    <Badge severity={r.severity} />
                  </td>
                  <td className="py-3 px-4 pg-code-sm text-[var(--pg-text)] align-top whitespace-nowrap">
                    {r.action}
                  </td>
                  <td className="py-3 px-4 align-top min-w-[240px]">
                    <div className="pg-label-md text-[var(--pg-text)]">{r.title}</div>
                    <div className="pg-body-sm text-[var(--pg-text-muted)] mt-0.5">
                      {r.description}
                    </div>
                  </td>
                  <td className="py-3 px-4 pg-body-sm text-[var(--pg-text-muted)] align-top min-w-[200px]">
                    {r.fixSummary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
