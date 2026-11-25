import React from "react";
import { Badge, Panel, Skeleton } from "../../../ui";
import { formatShortAge, inferRuleForEvent } from "../utils";
import type { ApiSecurityEvent } from "../../../services/api";

export function NeedsAttentionQueue({
  rankedEvents,
  loading,
  onSelectFinding,
}: {
  rankedEvents: readonly ApiSecurityEvent[];
  loading: boolean;
  onSelectFinding: (eventId: string) => void;
}) {
  const top = rankedEvents.slice(0, 6);

  return (
    <Panel padding="none" className="overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[var(--pg-line)] flex items-center justify-between gap-4">
        <div>
          <h2 className="pg-headline-sm text-[var(--pg-text)] m-0">Needs attention</h2>
          <p className="pg-body-sm text-[var(--pg-text-muted)] m-0 mt-0.5">
            Ordered by severity, then age of open findings.
          </p>
        </div>
        <span className="pg-data-md text-[var(--pg-text-muted)]">
          {rankedEvents.length} open
        </span>
      </div>

      {loading ? (
        <div className="p-4 space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4 py-1">
              <div className="flex items-center gap-3 flex-1">
                <Skeleton width="76px" height="22px" />
                <Skeleton width="180px" height="16px" />
              </div>
              <Skeleton width="48px" height="16px" />
            </div>
          ))}
        </div>
      ) : top.length === 0 ? (
        <div className="px-5 py-8 pg-body-sm text-[var(--pg-text-muted)]">
          No open findings. Connect a pipeline or run a workflow check to inspect new commits.
        </div>
      ) : (
        <ul className="m-0 p-0 list-none divide-y divide-[var(--pg-line)]">
          {top.map((evt) => {
            const rule = inferRuleForEvent(evt);
            const age = formatShortAge(evt.timestamp || evt.created_at);
            return (
              <li key={evt.event_id}>
                <button
                  type="button"
                  onClick={() => onSelectFinding(evt.event_id)}
                  className="w-full px-5 py-2.5 flex items-center justify-between gap-4 text-left hover:bg-[var(--pg-raised)] transition-colors duration-120 cursor-pointer bg-transparent"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge severity={evt.severity} />
                    <span className="pg-code-sm text-[var(--pg-text)] shrink-0">
                      {rule?.id ?? evt.event_id}
                    </span>
                    <span className="pg-body-sm text-[var(--pg-text-muted)] truncate">
                      {evt.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="pg-code-sm text-[var(--pg-text-muted)] hidden sm:inline">
                      {evt.pipeline_id || "global"}
                    </span>
                    <span className="pg-data-md text-[var(--pg-text)] w-8 text-right">
                      {age}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
