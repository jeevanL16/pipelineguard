import React from "react";
import { Badge, CodePanel, Panel, Tabs, type TabItem } from "../../../ui";

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
  return (
    <section className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-6">
      <div className="max-w-[40rem] space-y-2">
        <h2 className="pg-headline-lg text-[var(--pg-text)] m-0">
          How pipelines get compromised
        </h2>
        <p className="pg-body-md text-[var(--pg-text-muted)] m-0">
          Each attack stage leaves verifiable evidence in workflow files, logs, or digests.
        </p>
      </div>

      <Panel>
        <Tabs items={INCIDENT_TABS} defaultValue="unpinned-action" />
      </Panel>
    </section>
  );
}
