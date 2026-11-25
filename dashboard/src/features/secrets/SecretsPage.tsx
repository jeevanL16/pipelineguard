import React, { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { SECRET_PATTERN_RULES } from "../../rules/sampleWorkflows";
import { Badge, ErrorPanel, Panel } from "../../ui";
import { ApiError } from "../../services/api";
import {
  useAuditLogsQuery,
  useFindingsQuery,
  useUpdateFindingStatusMutation,
} from "../findings/queries";
import { FindingsTable } from "../findings/components/FindingsTable";
import { FindingDrawer } from "../findings/components/FindingDrawer";

export function SecretsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const eventsQuery = useFindingsQuery();
  const auditQuery = useAuditLogsQuery();
  const statusMutation = useUpdateFindingStatusMutation();

  const drawerId = searchParams.get("finding");
  const events = eventsQuery.data ?? [];

  const secretFindings = useMemo(() => {
    return events.filter(
      (e) =>
        e.source?.toLowerCase() === "secrets" ||
        e.event_type?.toLowerCase().includes("secret")
    );
  }, [events]);

  const activeFinding = drawerId
    ? events.find((e) => e.event_id === drawerId) ?? null
    : null;

  const openDrawer = (eventId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("finding", eventId);
    setSearchParams(next, { replace: false });
  };

  const closeDrawer = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("finding");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <p className="pg-body-sm text-[var(--pg-text-muted)] m-0 max-w-[40rem]">
        Secret scanning policy defined in{" "}
        <span className="pg-code-sm text-[var(--pg-text)]">security/secrets/severity.py</span>.
        Matched secrets are redacted before findings leave the runner.
      </p>

      {eventsQuery.isError && (
        <ErrorPanel
          message={
            eventsQuery.error instanceof Error
              ? eventsQuery.error.message
              : "Failed to load secret findings."
          }
          requestId={eventsQuery.error instanceof ApiError ? eventsQuery.error.requestId : null}
          onRetry={() => eventsQuery.refetch()}
        />
      )}

      <div className="space-y-2">
        <h2 className="pg-headline-sm text-[var(--pg-text)] m-0">
          Secret findings ({secretFindings.length})
        </h2>
        <FindingsTable
          events={secretFindings}
          loading={eventsQuery.isLoading}
          selectedFindingId={drawerId}
          onSelectFinding={openDrawer}
          onStatusChange={async (eventId, nextStatus, prev) => {
            await statusMutation.mutateAsync({
              eventId,
              status: nextStatus,
              previousStatus: prev,
            });
          }}
        />
      </div>

      <Panel padding="none" className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[var(--pg-line)]">
          <h2 className="pg-headline-sm text-[var(--pg-text)] m-0">
            Active secret severity policy
          </h2>
          <p className="pg-body-sm text-[var(--pg-text-muted)] m-0 mt-0.5">
            Every secret finding enforces BLOCK gate behavior and masks raw token bytes.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="border-b border-[var(--pg-line)] bg-[var(--pg-panel)]">
              <tr>
                <th className="py-2.5 px-4 pg-label-sm text-[var(--pg-text-muted)]">Rule</th>
                <th className="py-2.5 px-4 pg-label-sm text-[var(--pg-text-muted)]">Severity</th>
                <th className="py-2.5 px-4 pg-label-sm text-[var(--pg-text-muted)]">Pattern</th>
                <th className="py-2.5 px-4 pg-label-sm text-[var(--pg-text-muted)]">Policy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--pg-line)]">
              {SECRET_PATTERN_RULES.map((rule) => (
                <tr key={rule.id} className="hover:bg-[var(--pg-raised)] transition-colors">
                  <td className="py-3 px-4">
                    <div className="pg-label-md text-[var(--pg-text)]">{rule.name}</div>
                    <div className="pg-code-sm text-[var(--pg-text-muted)]">{rule.id}</div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <Badge severity={rule.severity} />
                  </td>
                  <td className="py-3 px-4 pg-code-sm text-[var(--pg-text-muted)]">
                    {rule.pattern}
                  </td>
                  <td className="py-3 px-4 pg-body-sm text-[var(--pg-text-muted)]">
                    {rule.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <FindingDrawer
        finding={activeFinding}
        auditLogs={auditQuery.data ?? []}
        onClose={closeDrawer}
        pending={statusMutation.isPending}
        onStatusChange={async (eventId, nextStatus, prev) => {
          await statusMutation.mutateAsync({
            eventId,
            status: nextStatus,
            previousStatus: prev,
          });
        }}
      />
    </div>
  );
}
