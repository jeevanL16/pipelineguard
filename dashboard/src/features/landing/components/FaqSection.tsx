import React from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "What repository access does PipelineGuard require?",
    a: "During metadata lookup, PipelineGuard checks public repository branches and workflow paths under .github/workflows. For private CI enforcement, you run the CLI or workflow action inside your runner and send structured findings to the backend API with a scoped token.",
  },
  {
    q: "What runs in the browser versus the backend?",
    a: "The live scan demo, workflow Playground, and artifact SHA-256 verification hash files run directly in your browser using the Web Crypto API and client rule engine. Connected pipelines, finding triage, and immutable status audit records persist in the FastAPI + SQLite backend.",
  },
  {
    q: "How does PipelineGuard handle secret values?",
    a: "Secret values are redacted before findings leave the runner and are never displayed in the browser dashboard. Only rule IDs, file locations, masked snippets, and severity scores are stored.",
  },
  {
    q: "How does PipelineGuard differ from a YAML syntax linter?",
    a: "Syntax linters verify formatting. PipelineGuard inspects workflow execution triggers, untrusted expression sinks, permission scopes, action SHA pinning, secret exposure patterns, and artifact SHA-256 provenance.",
  },
] as const;

export function FaqSection() {
  return (
    <section className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-6">
      <div className="max-w-[40rem] space-y-2">
        <h2 className="pg-headline-lg text-[var(--pg-text)] m-0">
          Questions
        </h2>
      </div>

      <div className="max-w-[40rem] divide-y divide-[var(--pg-line)] border-y border-[var(--pg-line)]">
        {FAQS.map((item) => (
          <details key={item.q} className="group py-4">
            <summary className="list-none flex items-center justify-between gap-4 cursor-pointer pg-headline-sm text-[var(--pg-text)]">
              <span>{item.q}</span>
              <ChevronDown
                size={16}
                strokeWidth={1.5}
                className="text-[var(--pg-text-muted)] shrink-0 transition-transform duration-120 group-open:rotate-180 motion-reduce:transition-none"
              />
            </summary>
            <p className="pg-body-sm text-[var(--pg-text-muted)] mt-3 mb-0">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
