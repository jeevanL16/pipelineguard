import React, { useMemo, useState } from "react";
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
import { Badge, EmptyState, ErrorPanel, Skeleton } from "../../ui";
import { ApiError, type ApiPipelineRun } from "../../services/api";
import { usePipelinesQuery, useRunsQuery } from "../pipelines/queries";
import { formatIsoDateTime } from "../findings/utils";

function formatDuration(start?: string | null, end?: string | null): string {
  if (!start || !end) return "In progress";
  const ms = Date.parse(end) - Date.parse(start);
  if (Number.isNaN(ms) || ms < 0) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${rem}s`;
}

export function RunsPage() {
  const runsQuery = useRunsQuery();
  const pipelinesQuery = usePipelinesQuery();
  const [sorting, setSorting] = useState<SortingState>([]);

  const pipelineById = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of pipelinesQuery.data ?? []) {
      map.set(p.id, p.pipeline_id);
    }
    return map;
  }, [pipelinesQuery.data]);

  const columns = useMemo<LegacyColumnDef<ApiPipelineRun>[]>(
    () => [
      {
        id: "run_id",
        header: "Run ID",
        accessorKey: "run_id",
        cell: ({ row }) => (
          <span className="pg-code-sm text-[var(--pg-text)] font-medium">
            {row.original.run_id}
          </span>
        ),
      },
      {
        id: "pipeline_id",
        header: "Pipeline",
        accessorFn: (row) => pipelineById.get(row.pipeline_id) ?? `id:${row.pipeline_id}`,
        cell: ({ row }) => (
          <span className="pg-code-sm text-[var(--pg-text-muted)]">
            {pipelineById.get(row.original.pipeline_id) ?? `pipeline #${row.original.pipeline_id}`}
          </span>
        ),
      },
      {
        id: "branch",
        header: "Branch",
        accessorFn: (row) => row.branch || "main",
        cell: ({ row }) => (
          <span className="pg-code-sm text-[var(--pg-text)]">{row.original.branch || "main"}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => {
          const st = (row.original.status || "").toUpperCase();
          if (st === "SUCCESS" || st === "COMPLETED") {
            return <Badge severity="PASS" label="Passed" />;
          }
          if (st === "FAILED") {
            return <Badge severity="CRITICAL" label="Failed" />;
          }
          return <Badge severity="INFO" label={row.original.status} />;
        },
      },
      {
        id: "duration",
        header: "Duration",
        accessorFn: (row) => formatDuration(row.started_at, row.completed_at),
        cell: ({ row }) => (
          <span className="pg-data-md text-[var(--pg-text-muted)]">
            {formatDuration(row.original.started_at, row.original.completed_at)}
          </span>
        ),
      },
      {
        id: "started_at",
        header: "Started",
        accessorFn: (row) => row.started_at || row.created_at,
        cell: ({ row }) => (
          <span className="pg-data-md text-[var(--pg-text-muted)]">
            {formatIsoDateTime(row.original.started_at || row.original.created_at)}
          </span>
        ),
      },
    ],
    [pipelineById]
  );

  const table = useLegacyTable({
    data: runsQuery.data ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="space-y-5">
      <p className="pg-body-sm text-[var(--pg-text-muted)] m-0">
        Recorded CI pipeline executions and outcome verification results.
      </p>

      {runsQuery.isError && (
        <ErrorPanel
          message={runsQuery.error instanceof Error ? runsQuery.error.message : "Failed to load runs."}
          requestId={runsQuery.error instanceof ApiError ? runsQuery.error.requestId : null}
          onRetry={() => runsQuery.refetch()}
        />
      )}

      {!runsQuery.isLoading && rows.length === 0 ? (
        <EmptyState
          title="No runs recorded"
          description="Pipeline executions appear here once CI workflows report run telemetry."
        />
      ) : (
        <div className="bg-[var(--pg-panel)] border border-[var(--pg-line)] rounded-[14px] overflow-hidden">
          <div className="overflow-x-auto max-h-[600px]">
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
                          className="py-2.5 px-4 pg-label-sm text-[var(--pg-text-muted)] whitespace-nowrap"
                        >
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1.5 text-inherit hover:text-[var(--pg-text)] bg-transparent cursor-pointer"
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
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-[var(--pg-line)]">
                {runsQuery.isLoading
                  ? [1, 2, 3].map((idx) => (
                      <tr key={idx} className="h-10">
                        <td className="px-4 py-2"><Skeleton width="90px" height="16px" /></td>
                        <td className="px-4 py-2"><Skeleton width="130px" height="16px" /></td>
                        <td className="px-4 py-2"><Skeleton width="70px" height="16px" /></td>
                        <td className="px-4 py-2"><Skeleton width="76px" height="20px" /></td>
                        <td className="px-4 py-2"><Skeleton width="60px" height="16px" /></td>
                        <td className="px-4 py-2"><Skeleton width="110px" height="16px" /></td>
                      </tr>
                    ))
                  : rows.map((row) => (
                      <tr key={row.id} className="h-9 hover:bg-[var(--pg-raised)] transition-colors">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="py-2 px-4 align-middle">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
