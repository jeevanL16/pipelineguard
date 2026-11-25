import React from "react";
import { Workflow, ShieldCheck, CheckCircle2, AlertTriangle, Code } from "lucide-react";

const WORKFLOW_RULES = [
  {
    id: "PG-WF-001",
    name: "Command Injection in Run Steps",
    severity: "CRITICAL",
    risk: 95,
    desc: "Detects untrusted expression expansion (${{ github.event... }}) directly inside run script steps.",
  },
  {
    id: "PG-WF-002",
    name: "Dangerous Event Triggers",
    severity: "HIGH",
    risk: 85,
    desc: "Flags pull_request_target and workflow_run triggers with checkout of untrusted PR code.",
  },
  {
    id: "PG-WF-003",
    name: "Excessive Token Permissions",
    severity: "MEDIUM",
    risk: 60,
    desc: "Enforces least privilege GITHUB_TOKEN permissions instead of default write-all.",
  },
  {
    id: "PG-WF-004",
    name: "Self-Hosted Runner Security",
    severity: "HIGH",
    risk: 80,
    desc: "Alerts on self-hosted runners executing public or untrusted pull requests without approval.",
  },
  {
    id: "PG-WF-005",
    name: "Supply Chain & Action Pinning",
    severity: "MEDIUM",
    risk: 50,
    desc: "Requires immutable commit SHAs for third-party GitHub Actions instead of mutable tags.",
  },
  {
    id: "PG-WF-006",
    name: "Workflow Modification Detection",
    severity: "HIGH",
    risk: 75,
    desc: "Detects unauthorized inline script modification of .github/workflows files.",
  },
];

export function WorkflowSecurityPage() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-950/40 to-[#0e1320] border border-indigo-900/40 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Workflow className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">GitHub Actions Workflow Guard</h2>
            <p className="text-xs text-gray-400">
              Deterministic AST & pattern engine scanning workflows against CI/CD attack vectors
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {WORKFLOW_RULES.map((rule) => (
          <div
            key={rule.id}
            className="bg-[#111827] border border-[#1f293d] p-5 rounded-xl space-y-3 hover:border-indigo-500/40 transition"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                {rule.id}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  rule.severity === "CRITICAL"
                    ? "bg-rose-950 text-rose-400 border border-rose-800"
                    : rule.severity === "HIGH"
                    ? "bg-amber-950 text-amber-400 border border-amber-800"
                    : "bg-blue-950 text-blue-400 border border-blue-800"
                }`}
              >
                {rule.severity} (Risk: {rule.risk})
              </span>
            </div>

            <h4 className="text-sm font-semibold text-white">{rule.name}</h4>
            <p className="text-xs text-gray-400 leading-relaxed">{rule.desc}</p>

            <div className="pt-2 border-t border-[#1f293d] flex items-center justify-between text-[11px] text-gray-500">
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Enforced in CI Gate
              </span>
              <span>Member 1 Engine</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
