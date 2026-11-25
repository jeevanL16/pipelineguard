import React from "react";
import { Badge, CodePanel, Drawer, Select, useToast } from "../../../ui";
import { normalizeSeverity, STATUS_LABELS, STATUS_VERBS } from "../../../rules/severity";
import type { FindingStatus } from "../../../rules/schemas";
import type { ApiAuditLog, ApiSecurityEvent } from "../../../services/api";
import {
  buildEvidenceYamlForEvent,
  formatIsoDateTime,
  inferRuleForEvent,
} from "../utils";

const STATUS_OPTIONS: readonly { value: FindingStatus; label: string }[] = [
  { value: "OPEN", label: STATUS_LABELS.OPEN },
  { value: "INVESTIGATING", label: STATUS_LABELS.INVESTIGATING },
  { value: "RESOLVED", label: STATUS_LABELS.RESOLVED },
  { value: "FALSE_POSITIVE", label: STATUS_LABELS.FALSE_POSITIVE },
];

export function FindingDrawer({
  finding,
  auditLogs,
  onClose,
  onStatusChange,
  pending,
}: {
  finding: ApiSecurityEvent | null;
  auditLogs: readonly ApiAuditLog[];
  onClose: () => void;
  onStatusChange: (eventId: string, nextStatus: FindingStatus, prevStatus: string) => Promise<void>;
  pending?: boolean;
}) {
  const { pushToast } = useToast();

  if (!finding) {
    return (
      <Drawer open={false} onOpenChange={() => onClose()} title="">
        {null}
      </Drawer>
    );
  }

  const rule = inferRuleForEvent(finding);
  const severity = normalizeSeverity(finding.severity);
  const evidence = buildEvidenceYamlForEvent(finding, rule);
  const relatedLogs = auditLogs.filter((l) => l.event_id === finding.event_id);

  const handleChange = async (next: string) => {
    const prev = finding.status || "OPEN";
    const nextStatus = next as FindingStatus;
    if (nextStatus === prev) return;
    try {
      await onStatusChange(finding.event_id, nextStatus, prev);
      pushToast({
        message: `${finding.event_id} ${STATUS_VERBS[nextStatus]}.`,
        tone: nextStatus === "RESOLVED" ? "pass" : "neutral",
        durationMs: 6000,
        actionLabel: "Undo",
        onAction: async () => {
          await onStatusChange(finding.event_id, prev as FindingStatus, nextStatus);
        },
      });
    } catch (err) {
      pushToast({
        message: err instanceof Error ? err.message : "Failed to update finding status.",
        tone: "critical",
      });
    }
  };

  return (
    <Drawer
      open={Boolean(finding)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={rule ? rule.title : finding.event_type}
      subtitle={`${finding.event_id}${rule ? ` · ${rule.id} (${rule.cwe})` : ""}`}
    >
      <div className="space-y-6">
        {/* Summary & Status Control */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--pg-line)]">
          <div className="flex items-center gap-3">
            <Badge severity={severity} />
            <span className="pg-data-md text-[var(--pg-text)]">
              Risk {finding.risk_score}/100
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="drawer-status-select" className="pg-label-sm text-[var(--pg-text-muted)]">
              Status
            </label>
            <Select
              id="drawer-status-select"
              size="compact"
              disabled={pending}
              value={finding.status || "OPEN"}
              options={STATUS_OPTIONS}
              onValueChange={handleChange}
            />
          </div>
        </div>

        {/* Description & Metadata */}
        <div className="space-y-2">
          <h3 className="pg-label-md text-[var(--pg-text)] m-0">What was detected</h3>
          <p className="pg-body-sm text-[var(--pg-text)] m-0">{finding.description}</p>
          <dl className="grid grid-cols-2 gap-3 pt-2 pg-body-sm">
            <div>
              <dt className="text-[var(--pg-text-muted)]">Pipeline</dt>
              <dd className="pg-code-sm text-[var(--pg-text)] m-0">
                {finding.pipeline_id || "global"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--pg-text-muted)]">Source</dt>
              <dd className="pg-code-sm text-[var(--pg-text)] m-0">{finding.source}</dd>
            </div>
          </dl>
        </div>

        {/* Offending lines */}
        <div className="space-y-2">
          <h3 className="pg-label-md text-[var(--pg-text)] m-0">Offending pattern</h3>
          <CodePanel
            title={rule ? `${rule.id} example` : finding.source}
            code={evidence.code}
            lineAnnotations={{
              [evidence.flaggedLine]: { severity },
            }}
          />
        </div>

        {/* Suggested Fix */}
        <div className="space-y-2">
          <h3 className="pg-label-md text-[var(--pg-text)] m-0">Suggested remediation</h3>
          <p className="pg-body-sm text-[var(--pg-text-muted)] m-0">
            {rule ? rule.remediation : "Verify workflow configuration and rotate exposed credentials."}
          </p>
          <CodePanel
            code={`${evidence.fixDiffRemoved}\n${evidence.fixDiffAdded}`}
            lineAnnotations={{
              1: { diff: "removed" },
              2: { diff: "added" },
            }}
          />
        </div>

        {/* Status History */}
        <div className="space-y-2.5 pt-2 border-t border-[var(--pg-line)]">
          <h3 className="pg-label-md text-[var(--pg-text)] m-0">Status history</h3>
          {relatedLogs.length === 0 ? (
            <p className="pg-body-sm text-[var(--pg-text-muted)] m-0">
              No status transitions recorded for this finding yet.
            </p>
          ) : (
            <ul className="m-0 p-0 list-none space-y-2">
              {relatedLogs.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center justify-between gap-3 py-1.5 border-b border-[var(--pg-line)] last:border-b-0 pg-body-sm"
                >
                  <span className="pg-code-sm text-[var(--pg-text)]">
                    {log.previous_status || "OPEN"} → {log.new_status}
                  </span>
                  <span className="text-[var(--pg-text-muted)] pg-data-md">
                    {log.actor} · {formatIsoDateTime(log.changed_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Drawer>
  );
}
