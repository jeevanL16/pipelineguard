import React, { useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { m } from "motion/react";
import { GitBranch, GitFork, Globe } from "lucide-react";
import { Badge, Button, EmptyState, ErrorPanel, Panel, Skeleton } from "../../ui";
import { SeverityShapeIcon } from "../../ui/Badge";
import { ApiError } from "../../services/api";
import { usePipelinesQuery } from "./queries";
import type { DashboardOutletContext } from "../shell/DashboardShell";
import { MOTION } from "../../motion/motion";
import { formatIsoDate } from "../findings/utils";

import { RECENT_CONNECTED_KEY } from "./components/ConnectRepositoryDialog";

const FIRST_SCAN_STEPS = [
  "Queued",
  "Reading workflows",
  "Applying rules",
  "Recorded",
] as const;

export function PipelinesPage() {
  const { openConnectDialog } = useOutletContext<DashboardOutletContext>();
  const pipelinesQuery = usePipelinesQuery();
  const connectBtnRef = useRef<HTMLButtonElement | null>(null);
  const [recentConnectedId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(RECENT_CONNECTED_KEY);
    } catch {
      return null;
    }
  });

  const pipelines = pipelinesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="pg-body-sm text-[var(--pg-text-muted)] m-0">
            Repositories connected for workflow, secret, and artifact inspection.
          </p>
        </div>

        <Button
          ref={connectBtnRef}
          variant="primary"
          onClick={() => openConnectDialog(connectBtnRef.current)}
        >
          Connect repository
        </Button>
      </div>

      {pipelinesQuery.isError && (
        <ErrorPanel
          message={
            pipelinesQuery.error instanceof Error
              ? pipelinesQuery.error.message
              : "Failed to load pipelines."
          }
          requestId={
            pipelinesQuery.error instanceof ApiError
              ? pipelinesQuery.error.requestId
              : null
          }
          onRetry={() => pipelinesQuery.refetch()}
        />
      )}

      {pipelinesQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map((idx) => (
            <Panel key={idx} className="space-y-3">
              <Skeleton width="60%" height="20px" />
              <Skeleton width="85%" height="16px" />
              <Skeleton width="40%" height="16px" />
            </Panel>
          ))}
        </div>
      ) : pipelines.length === 0 ? (
        <EmptyState
          title="No pipelines yet"
          description="No pipelines yet. Connect a repository to start scanning its workflows."
          actionLabel="Connect repository"
          onAction={() => openConnectDialog(connectBtnRef.current)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {pipelines.map((pipe) => {
            const active = pipe.status?.toUpperCase() !== "PAUSED";
            return (
              <m.div key={pipe.pipeline_id} layout transition={MOTION.surfaceEnter}>
                <Panel className="h-full flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="inline-flex items-center gap-2 pg-code-md text-[var(--pg-text)] font-medium truncate max-w-full">
                          <GitBranch
                            size={15}
                            strokeWidth={1.5}
                            className="text-[var(--pg-primary)] shrink-0"
                          />
                          <span className="truncate">{pipe.pipeline_id}</span>
                        </div>
                        {pipe.name !== pipe.pipeline_id && (
                          <div className="pg-body-sm text-[var(--pg-text-muted)] truncate mt-0.5">
                            {pipe.name}
                          </div>
                        )}
                      </div>
                      <Badge
                        severity={active ? "PASS" : "INFO"}
                        label={active ? "Active" : "Paused"}
                      />
                    </div>

                    <div className="flex items-center gap-2 pg-code-sm text-[var(--pg-text-muted)] truncate">
                      <Globe size={14} strokeWidth={1.5} className="shrink-0" />
                      <span className="truncate">{pipe.repository || "Local repository"}</span>
                    </div>

                    {recentConnectedId === pipe.pipeline_id && (
                      <div className="pt-2 border-t border-[var(--pg-line)] flex flex-wrap gap-2">
                        {FIRST_SCAN_STEPS.map((step) => (
                          <span
                            key={step}
                            className="inline-flex items-center gap-1 pg-label-sm text-[var(--pg-pass)]"
                          >
                            <SeverityShapeIcon shape="check" />
                            {step}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[var(--pg-line)] flex items-center justify-between gap-2 pg-body-sm text-[var(--pg-text-muted)]">
                    <span className="inline-flex items-center gap-1.5 pg-code-sm">
                      <GitFork size={14} strokeWidth={1.5} />
                      {pipe.branch || "main"}
                    </span>
                    <span className="pg-data-md">
                      {formatIsoDate(pipe.created_at)}
                    </span>
                  </div>
                </Panel>
              </m.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
