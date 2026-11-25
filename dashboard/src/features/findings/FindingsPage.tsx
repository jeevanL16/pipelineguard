import React from "react";
import { useSearchParams } from "react-router-dom";
import { Chip, ErrorPanel } from "../../ui";
import { ApiError } from "../../services/api";
import type { FindingStatus, Severity } from "../../rules/schemas";
import { STATUS_LABELS } from "../../rules/severity";
import {
  useAuditLogsQuery,
  useFindingsQuery,
  useUpdateFindingStatusMutation,
} from "./queries";
import { FindingsTable } from "./components/FindingsTable";
import { FindingDrawer } from "./components/FindingDrawer";

const SEVERITY_FILTERS: readonly Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const STATUS_FILTERS: readonly FindingStatus[] = [
  "OPEN",
  "INVESTIGATING",
  "RESOLVED",
  "FALSE_POSITIVE",
];

export function FindingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const eventsQuery = useFindingsQuery();
  const auditQuery = useAuditLogsQuery();
  const statusMutation = useUpdateFindingStatusMutation();

  const selectedSevs = (searchParams.get("severity") || "")
    .split(",")
    .filter(Boolean);
  const selectedStatuses = (searchParams.get("status") || "")
    .split(",")
    .filter(Boolean);
  const drawerId = searchParams.get("finding");

  const toggleParamValue = (key: "severity" | "status", val: string) => {
    const next = new URLSearchParams(searchParams);
    const current = (next.get(key) || "").split(",").filter(Boolean);
    const updated = current.includes(val)
      ? current.filter((x) => x !== val)
      : [...current, val];
    if (updated.length > 0) {
      next.set(key, updated.join(","));
    } else {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("severity");
    next.delete("status");
    setSearchParams(next, { replace: true });
  };

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

  const events = eventsQuery.data ?? [];
  const filtered = events.filter((evt) => {
    const sevOk =
      selectedSevs.length === 0 ||
      selectedSevs.includes((evt.severity || "").toUpperCase());
    const statusOk =
      selectedStatuses.length === 0 ||
      selectedStatuses.includes((evt.status || "OPEN").toUpperCase());
    return sevOk && statusOk;
  });

  const activeFinding = drawerId
    ? events.find((e) => e.event_id === drawerId) ?? null
    : null;

  return (
    <div className="space-y-5">
      <div>
        <p className="pg-body-sm text-[var(--pg-text-muted)] m-0">
          Security findings detected across workflow definitions, secrets scans, and build artifacts.
        </p>
      </div>

      {/* URL-synced filter chips */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by severity">
          <span className="pg-label-sm text-[var(--pg-text-muted)] mr-1">Severity</span>
          {SEVERITY_FILTERS.map((sev) => (
            <Chip
              key={sev}
              selected={selectedSevs.includes(sev)}
              onClick={() => toggleParamValue("severity", sev)}
            >
              {sev.charAt(0) + sev.slice(1).toLowerCase()}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
          <span className="pg-label-sm text-[var(--pg-text-muted)] mr-1">Status</span>
          {STATUS_FILTERS.map((st) => (
            <Chip
              key={st}
              selected={selectedStatuses.includes(st)}
              onClick={() => toggleParamValue("status", st)}
            >
              {STATUS_LABELS[st]}
            </Chip>
          ))}
        </div>
      </div>

      {eventsQuery.isError && (
        <ErrorPanel
          message={
            eventsQuery.error instanceof Error
              ? eventsQuery.error.message
              : "Failed to load findings."
          }
          requestId={
            eventsQuery.error instanceof ApiError ? eventsQuery.error.requestId : null
          }
          onRetry={() => eventsQuery.refetch()}
        />
      )}

      <FindingsTable
        events={filtered}
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
        hasActiveFilters={selectedSevs.length > 0 || selectedStatuses.length > 0}
        onClearFilters={clearFilters}
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
