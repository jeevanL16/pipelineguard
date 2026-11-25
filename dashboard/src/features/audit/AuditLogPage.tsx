import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { EmptyState, ErrorPanel, Skeleton } from "../../ui";
import { ApiError, type ApiAuditLog } from "../../services/api";
import { useAuditLogsQuery } from "../findings/queries";
import { formatIsoDateTime } from "../findings/utils";

export function AuditLogPage() {
  const navigate = useNavigate();
  const auditQuery = useAuditLogsQuery();
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<LegacyColumnDef<ApiAuditLog>[]>(
    () => [
      {
        id: "id",
        header: "Record",
        accessorKey: "id",
        cell: ({ row }) => (
          <span className="pg-code-sm text-[var(--pg-text-muted)]">#{row.original.id}</span>
        ),
      },
      {
        id: "event_id",
        header: "Finding",
        accessorKey: "event_id",
        cell: ({ row }) => (
          <span className="pg-code-sm text-[var(--pg-primary)] font-medium">
            {row.original.event_id}
          </span>
        ),
      },
      {
        id: "transition",
        header: "Status transition",
        accessorFn: (row) => `${row.previous_status || "OPEN"} -> ${row.new_status}`,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2 pg-code-sm">
            <span className="text-[var(--pg-text-muted)]">
              {row.original.previous_status || "OPEN"}
            </span>
            <span aria-hidden="true" className="text-[var(--pg-text-muted)]">→</span>
            <span className="text-[var(--pg-text)]">{row.original.new_status}</span>
          </span>
        ),
      },
      {
        id: "actor",
        header: "Actor",
        accessorKey: "actor",
        cell: ({ row }) => (
          <span className="pg-body-sm text-[var(--pg-text)]">{row.original.actor}</span>
        ),
      },
      {
        id: "changed_at",
        header: "Changed",
        accessorFn: (row) => row.changed_at || "",
        cell: ({ row }) => (
          <span className="pg-data-md text-[var(--pg-text-muted)]">
            {formatIsoDateTime(row.original.changed_at)}
          </span>
        ),
      },
    ],
    []
  );

  const table = useLegacyTable({
    data: auditQuery.data ?? [],
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
        Append-only record of finding status transitions and analyst sign-offs.
      </p>

      {auditQuery.isError && (
        <ErrorPanel
          message={
            auditQuery.error instanceof Error
              ? auditQuery.error.message
              : "Failed to load audit log."
          }
          requestId={auditQuery.error instanceof ApiError ? auditQuery.error.requestId : null}
          onRetry={() => auditQuery.refetch()}
        />
      )}

      {!auditQuery.isLoading && rows.length === 0 ? (
        <EmptyState
          title="No audit entries yet"
          description="Changing a finding status records a permanent entry here."
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
                {auditQuery.isLoading
                  ? [1, 2, 3].map((idx) => (
                      <tr key={idx} className="h-10">
                        <td className="px-4 py-2"><Skeleton width="40px" height="16px" /></td>
                        <td className="px-4 py-2"><Skeleton width="100px" height="16px" /></td>
                        <td className="px-4 py-2"><Skeleton width="160px" height="16px" /></td>
                        <td className="px-4 py-2"><Skeleton width="70px" height="16px" /></td>
                        <td className="px-4 py-2"><Skeleton width="110px" height="16px" /></td>
                      </tr>
                    ))
                  : rows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() =>
                          navigate(
                            `/app/findings?finding=${encodeURIComponent(row.original.event_id)}`
                          )
                        }
                        className="h-9 hover:bg-[var(--pg-raised)] transition-colors cursor-pointer"
                      >
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
