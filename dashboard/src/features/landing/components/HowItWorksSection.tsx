import React from "react";

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
  return (
    <section id="how-it-works" className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-8">
      <div className="max-w-[40rem] space-y-2">
        <h2 className="pg-headline-lg text-[var(--pg-text)] m-0">
          From repository to audit log
        </h2>
        <p className="pg-body-md text-[var(--pg-text-muted)] m-0">
          Four deterministic stages run on every connected workflow change.
        </p>
      </div>

      <div className="relative">
        {/* Horizontal gate line on md+, vertical line on mobile, CSS scroll view() animated */}
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
          {STEPS.map((step) => (
            <li key={step.number} className="flex md:block items-start gap-4">
              <div className="relative z-10 w-8 h-8 rounded-[4px] border border-[var(--pg-primary)] bg-[var(--pg-panel)] text-[var(--pg-primary)] pg-data-md flex items-center justify-center shrink-0">
                {step.number}
              </div>
              <div className="md:mt-4 space-y-1.5">
                <h3 className="pg-headline-sm text-[var(--pg-text)] m-0">{step.name}</h3>
                <p className="pg-body-sm text-[var(--pg-text-muted)] m-0">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
