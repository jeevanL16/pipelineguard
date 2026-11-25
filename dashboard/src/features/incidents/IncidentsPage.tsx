import React, { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ErrorPanel, Panel } from "../../ui";
import { ApiError } from "../../services/api";
import {
  rankNeedsAttention,
  useAuditLogsQuery,
  useFindingsQuery,
  useUpdateFindingStatusMutation,
} from "../findings/queries";
import { FindingsTable } from "../findings/components/FindingsTable";
import { FindingDrawer } from "../findings/components/FindingDrawer";

export function IncidentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const eventsQuery = useFindingsQuery();
  const auditQuery = useAuditLogsQuery();
  const statusMutation = useUpdateFindingStatusMutation();

  const drawerId = searchParams.get("finding");
  const events = eventsQuery.data ?? [];

  const activeIncidents = useMemo(() => {
    const ranked = rankNeedsAttention(events);
    return ranked.filter((e) => {
      const sev = (e.severity || "").toUpperCase();
      return sev === "CRITICAL" || sev === "HIGH";
    });
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
      <Panel padding="md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="pg-headline-sm text-[var(--pg-text)] m-0">
              Active high-severity incidents
            </h2>
            <p className="pg-body-sm text-[var(--pg-text-muted)] m-0 mt-1">
              Open or investigating critical and high findings awaiting containment or sign-off.
            </p>
          </div>
          <span className="pg-data-md text-[var(--pg-text)]">
            {activeIncidents.length} requiring action
          </span>
        </div>
      </Panel>

      {eventsQuery.isError && (
        <ErrorPanel
          message={
            eventsQuery.error instanceof Error
              ? eventsQuery.error.message
              : "Unable to load incidents."
          }
          requestId={eventsQuery.error instanceof ApiError ? eventsQuery.error.requestId : null}
          onRetry={() => eventsQuery.refetch()}
        />
      )}

      <FindingsTable
        events={activeIncidents}
        loading={eventsQuery.isLoading}
        selectedFindingId={drawerId}
        onSelectFinding={openDrawer}
        onStatusChange={async (eventId, nextStatus, previousStatus) => {
          await statusMutation.mutateAsync({
            eventId,
            status: nextStatus,
            previousStatus,
          });
        }}
      />

      <FindingDrawer
        finding={activeFinding}
        auditLogs={auditQuery.data ?? []}
        onClose={closeDrawer}
        pending={statusMutation.isPending}
        onStatusChange={async (eventId, nextStatus, previousStatus) => {
          await statusMutation.mutateAsync({
            eventId,
            status: nextStatus,
            previousStatus,
          });
        }}
      />
    </div>
  );
}
