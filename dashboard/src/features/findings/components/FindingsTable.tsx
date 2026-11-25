import React, { startTransition, useEffect, useMemo, useOptimistic, useState } from "react";
import {
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import {
  getCoreRowModel,
  getSortedRowModel,
  useLegacyTable,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Badge, EmptyState, Select, Skeleton, useToast } from "../../../ui";
import { SEVERITY_META, STATUS_LABELS, STATUS_VERBS } from "../../../rules/severity";
import type { FindingStatus } from "../../../rules/schemas";
import type { ApiSecurityEvent } from "../../../services/api";
import { formatIsoDate, inferRuleForEvent } from "../utils";

export type TableDensity = "compact" | "default" | "comfortable";

const DENSITY_KEY = "pg-table-density";

const DENSITY_ROW_HEIGHT: Record<TableDensity, string> = {
  compact: "h-7", // 28px
  default: "h-9", // 36px
  comfortable: "h-11", // 44px
};

const DENSITY_PAD: Record<TableDensity, string> = {
  compact: "py-1 px-3",
  default: "py-1.5 px-4",
  comfortable: "py-2.5 px-4",
};

const STATUS_SELECT_OPTIONS: readonly { value: FindingStatus; label: string }[] = [
  { value: "OPEN", label: STATUS_LABELS.OPEN },
  { value: "INVESTIGATING", label: STATUS_LABELS.INVESTIGATING },
  { value: "RESOLVED", label: STATUS_LABELS.RESOLVED },
  { value: "FALSE_POSITIVE", label: STATUS_LABELS.FALSE_POSITIVE },
];

export interface FindingsTableProps {
  events: readonly ApiSecurityEvent[];
  loading: boolean;
  onSelectFinding: (eventId: string) => void;
  selectedFindingId?: string | null;
  onStatusChange: (eventId: string, nextStatus: FindingStatus, prevStatus: string) => Promise<void>;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

export function FindingsTable({
  events,
  loading,
  onSelectFinding,
  selectedFindingId,
  onStatusChange,
  hasActiveFilters = false,
  onClearFilters,
}: FindingsTableProps) {
  const { pushToast } = useToast();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [density, setDensity] = useState<TableDensity>(() => {
    try {
      const saved = localStorage.getItem(DENSITY_KEY);
      if (saved === "compact" || saved === "default" || saved === "comfortable") {
        return saved;
      }
    } catch {
      // ignore
    }
    return "default";
  });
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [flashingId, setFlashingId] = useState<string | null>(null);

  const [optimisticEvents, applyOptimistic] = useOptimistic(
    events as ApiSecurityEvent[],
    (state, update: { eventId: string; status: FindingStatus }) =>
      state.map((e) =>
        e.event_id === update.eventId ? { ...e, status: update.status } : e
      )
  );

  const changeDensity = (next: TableDensity) => {
    setDensity(next);
    try {
      localStorage.setItem(DENSITY_KEY, next);
    } catch {
      // ignore
    }
  };

  const triggerStatusChange = (
    eventId: string,
    nextStatus: FindingStatus,
    previousStatus: string
  ) => {
    if (nextStatus === previousStatus) return;

    setFlashingId(eventId);
    setTimeout(() => setFlashingId((cur) => (cur === eventId ? null : cur)), 620);

    startTransition(async () => {
      applyOptimistic({ eventId, status: nextStatus });
      try {
        await onStatusChange(eventId, nextStatus, previousStatus);
        const verb = STATUS_VERBS[nextStatus];
        pushToast({
          message: `${eventId} ${verb}.`,
          tone: nextStatus === "RESOLVED" ? "pass" : "neutral",
          durationMs: 6000,
          actionLabel: "Undo",
          onAction: async () => {
            startTransition(async () => {
              applyOptimistic({
                eventId,
                status: (previousStatus as FindingStatus) || "OPEN",
              });
              await onStatusChange(
                eventId,
                (previousStatus as FindingStatus) || "OPEN",
                nextStatus
              );
              setFlashingId(eventId);
              setTimeout(() => setFlashingId((cur) => (cur === eventId ? null : cur)), 620);
            });
          },
        });
      } catch (err) {
        pushToast({
          message:
            err instanceof Error
              ? `Unable to update status: ${err.message}`
              : "Unable to update status.",
          tone: "critical",
        });
      }
    });
  };

  const columns = useMemo<LegacyColumnDef<ApiSecurityEvent>[]>(
    () => [
      {
        id: "rule",
        header: "Finding",
        accessorFn: (row) => `${row.event_id} ${row.event_type}`,
        cell: ({ row }) => {
          const evt = row.original;
          const rule = inferRuleForEvent(evt);
          return (
            <div className="min-w-[200px]">
              <div className="flex items-center gap-2">
                <span className="pg-code-sm text-[var(--pg-text)] font-medium">
                  {rule?.id ?? evt.event_id}
                </span>
                <span className="pg-body-sm text-[var(--pg-text)] truncate max-w-[260px]">
                  {evt.event_type}
                </span>
              </div>
              {density !== "compact" && (
                <div className="pg-code-sm text-[var(--pg-text-muted)] text-[11px] truncate max-w-[320px]">
                  {evt.event_id}
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: "severity",
        header: "Severity",
        accessorFn: (row) => {
          const key = (row.severity || "INFO").toUpperCase() as keyof typeof SEVERITY_META;
          return SEVERITY_META[key]?.order ?? 99;
        },
        cell: ({ row }) => <Badge severity={row.original.severity} />,
      },
      {
        id: "risk_score",
        header: "Risk",
        accessorKey: "risk_score",
        cell: ({ row }) => (
          <span className="pg-data-md text-[var(--pg-text)]">{row.original.risk_score}</span>
        ),
      },
      {
        id: "pipeline_id",
        header: "Pipeline",
        accessorFn: (row) => row.pipeline_id || "global",
        cell: ({ row }) => (
          <span className="pg-code-sm text-[var(--pg-text-muted)]">
            {row.original.pipeline_id || "global"}
          </span>
        ),
      },
      {
        id: "source",
        header: "Source",
        accessorKey: "source",
        cell: ({ row }) => (
          <span className="pg-body-sm text-[var(--pg-text-muted)]">{row.original.source}</span>
        ),
      },
      {
        id: "timestamp",
        header: "Recorded",
        accessorFn: (row) => row.timestamp || row.created_at || "",
        cell: ({ row }) => (
          <span className="pg-data-md text-[var(--pg-text-muted)] whitespace-nowrap">
            {formatIsoDate(row.original.timestamp || row.original.created_at)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        enableSorting: true,
        cell: ({ row }) => {
          const evt = row.original;
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <Select
                size="compact"
                ariaLabel={`Status for ${evt.event_id}`}
                value={evt.status || "OPEN"}
                options={STATUS_SELECT_OPTIONS}
                onValueChange={(next) =>
                  triggerStatusChange(evt.event_id, next as FindingStatus, evt.status || "OPEN")
                }
              />
            </div>
          );
        },
      },
    ],
    [density]
  );

  const table = useLegacyTable({
    data: optimisticEvents,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  // j / k row navigation and Enter to open evidence drawer
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (document.querySelector('[role="dialog"]')) return;
      if (rows.length === 0) return;

      if (e.key === "j") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(rows.length - 1, prev + 1));
      } else if (e.key === "k") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(0, prev <= 0 ? 0 : prev - 1));
      } else if (e.key === "Enter" && focusedIndex >= 0 && rows[focusedIndex]) {
        e.preventDefault();
        onSelectFinding(rows[focusedIndex].original.event_id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rows, focusedIndex, onSelectFinding]);

  if (!loading && rows.length === 0) {
    return (
      <EmptyState
        title={hasActiveFilters ? "No findings match these filters" : "No findings recorded"}
        description={
          hasActiveFilters
            ? "Reset severity or status filters to inspect all recorded pipeline findings."
            : "Connect a repository and trigger a pipeline run to collect findings."
        }
        actionLabel={hasActiveFilters && onClearFilters ? "Clear filters" : undefined}
        onAction={onClearFilters}
      />
    );
  }

  return (
    <div className="bg-[var(--pg-panel)] border border-[var(--pg-line)] rounded-[14px] overflow-hidden">
      {/* Toolbar: density switcher + keyboard hint */}
      <div className="px-4 py-2.5 border-b border-[var(--pg-line)] flex flex-wrap items-center justify-between gap-3">
        <div className="pg-body-sm text-[var(--pg-text-muted)] pg-tnum">
          {loading ? "Loading findings…" : `${rows.length} findings`}
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden md:inline pg-body-sm text-[var(--pg-text-muted)]">
            Press j / k to move, Enter to inspect
          </span>
          <div
            role="group"
            aria-label="Row density"
            className="inline-flex items-center rounded-[6px] border border-[var(--pg-line)] bg-[var(--pg-canvas)] p-0.5"
          >
            {(["compact", "default", "comfortable"] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={density === d}
                onClick={() => changeDensity(d)}
                className={`px-2 py-1 rounded-[4px] pg-label-sm capitalize cursor-pointer transition-colors ${
                  density === d
                    ? "bg-[var(--pg-raised)] text-[var(--pg-text)]"
                    : "text-[var(--pg-text-muted)] hover:text-[var(--pg-text)]"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[640px]">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[var(--pg-panel)] border-b border-[var(--pg-line)]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const ariaSort =
                    sorted === "asc"
                      ? "ascending"
                      : sorted === "desc"
                      ? "descending"
                      : "none";
                  return (
                    <th
                      key={header.id}
                      aria-sort={header.column.getCanSort() ? ariaSort : undefined}
                      className="py-2.5 px-4 pg-label-sm text-[var(--pg-text-muted)] whitespace-nowrap bg-[var(--pg-panel)]"
                    >
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1.5 text-inherit hover:text-[var(--pg-text)] cursor-pointer bg-transparent"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp size={13} strokeWidth={1.5} />
                          ) : sorted === "desc" ? (
                            <ArrowDown size={13} strokeWidth={1.5} />
                          ) : (
                            <ArrowUpDown size={13} strokeWidth={1.5} className="opacity-50" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody className="divide-y divide-[var(--pg-line)]">
            {loading
              ? [1, 2, 3, 4].map((idx) => (
                  <tr key={`skel-${idx}`} className="h-11">
                    <td className="px-4 py-2"><Skeleton width="180px" height="16px" /></td>
                    <td className="px-4 py-2"><Skeleton width="72px" height="20px" /></td>
                    <td className="px-4 py-2"><Skeleton width="32px" height="16px" /></td>
                    <td className="px-4 py-2"><Skeleton width="120px" height="16px" /></td>
                    <td className="px-4 py-2"><Skeleton width="64px" height="16px" /></td>
                    <td className="px-4 py-2"><Skeleton width="84px" height="16px" /></td>
                    <td className="px-4 py-2"><Skeleton width="110px" height="28px" /></td>
                  </tr>
                ))
              : rows.map((row, idx) => {
                  const evt = row.original;
                  const isFocused = focusedIndex === idx;
                  const isSelected = selectedFindingId === evt.event_id;
                  const isFlashing = flashingId === evt.event_id;

                  return (
                    <tr
                      key={row.id}
                      onClick={() => {
                        setFocusedIndex(idx);
                        onSelectFinding(evt.event_id);
                      }}
                      className={`cursor-pointer transition-colors duration-120 hover:bg-[var(--pg-raised)] ${
                        DENSITY_ROW_HEIGHT[density]
                      } ${isSelected || isFocused ? "bg-[var(--pg-raised)]" : ""} ${
                        isFlashing ? "pg-row-flash" : ""
                      }`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={`${DENSITY_PAD[density]} align-middle rounded-none`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
