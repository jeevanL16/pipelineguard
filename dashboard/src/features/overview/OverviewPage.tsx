import React, { useMemo } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button, ErrorPanel, Panel } from "../../ui";
import { SeverityShapeIcon } from "../../ui/Badge";
import { ApiError } from "../../services/api";
import {
  rankNeedsAttention,
  useFindingsQuery,
  useUpdateFindingStatusMutation,
} from "../findings/queries";
import { NeedsAttentionQueue } from "../findings/components/NeedsAttentionQueue";
import { FindingDrawer } from "../findings/components/FindingDrawer";
import { usePipelinesQuery, useRunsQuery } from "../pipelines/queries";
import { useAuditLogsQuery } from "../findings/queries";
import { ConnectRepositoryForm } from "../pipelines/components/ConnectRepositoryForm";
import { useToast } from "../../ui";
import type { DashboardOutletContext } from "../shell/DashboardShell";
import { formatShortAge } from "../findings/utils";

export function OverviewPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { openConnectDialog } = useOutletContext<DashboardOutletContext>();
  const { pushToast } = useToast();

  const eventsQuery = useFindingsQuery();
  const pipelinesQuery = usePipelinesQuery();
  const runsQuery = useRunsQuery();
  const auditQuery = useAuditLogsQuery();
  const statusMutation = useUpdateFindingStatusMutation();

  const selectedFindingId = searchParams.get("finding");
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
  const pipelines = pipelinesQuery.data ?? [];
  const runs = runsQuery.data ?? [];

  const ranked = useMemo(() => rankNeedsAttention(events), [events]);

  const openEvents = ranked;
  const criticalCount = openEvents.filter(
    (e) => e.severity?.toUpperCase() === "CRITICAL"
  ).length;
  const highCount = openEvents.filter(
    (e) => e.severity?.toUpperCase() === "HIGH"
  ).length;
  const mediumCount = openEvents.filter(
    (e) => e.severity?.toUpperCase() === "MEDIUM"
  ).length;
  const lowCount = openEvents.filter(
    (e) => e.severity?.toUpperCase() === "LOW"
  ).length;

  const affectedPipelinesCount = new Set(
    openEvents.filter((e) => e.severity?.toUpperCase() === "CRITICAL").map((e) => e.pipeline_id)
  ).size;

  const oldestTimestamp = useMemo(() => {
    if (openEvents.length === 0) return null;
    let minTs = Infinity;
    for (const evt of openEvents) {
      const ts = Date.parse(evt.timestamp || evt.created_at || "");
      if (!Number.isNaN(ts) && ts < minTs) {
        minTs = ts;
      }
    }
    return minTs === Infinity ? null : new Date(minTs).toISOString();
  }, [openEvents]);

  const oldestAge = oldestTimestamp ? formatShortAge(oldestTimestamp) : "0m";

  const totalOpenForBar = Math.max(1, criticalCount + highCount + mediumCount + lowCount);

  // Single-series run risk trend strictly grouped from real recorded finding dates
  const chartData = useMemo(() => {
    const byDay = new Map<string, { sum: number; count: number; ts: number }>();
    for (const evt of events) {
      const rawDate = evt.timestamp || evt.created_at;
      const ms = rawDate ? Date.parse(rawDate) : NaN;
      if (Number.isNaN(ms)) continue;
      const d = new Date(ms);
      const dayKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      const existing = byDay.get(dayKey);
      if (existing) {
        existing.sum += evt.risk_score;
        existing.count += 1;
      } else {
        byDay.set(dayKey, { sum: evt.risk_score, count: 1, ts: ms });
      }
    }
    return Array.from(byDay.entries())
      .sort((a, b) => a[1].ts - b[1].ts)
      .slice(-14)
      .map(([day, agg]) => ({
        day: day.slice(5),
        risk: Math.round(agg.sum / agg.count),
      }));
  }, [events]);

  const activeFinding = selectedFindingId
    ? events.find((e) => e.event_id === selectedFindingId) ?? null
    : null;

  // First-run onboarding state when zero pipelines are registered
  if (!pipelinesQuery.isLoading && pipelines.length === 0) {
    return (
      <div className="max-w-[720px] space-y-6">
        <Panel>
          <div className="space-y-5">
            <div>
              <h2 className="pg-headline-md text-[var(--pg-text)] m-0">
                Connect your first repository
              </h2>
              <p className="pg-body-sm text-[var(--pg-text-muted)] mt-1 m-0">
                Once connected, PipelineGuard inspects workflow triggers, secret patterns, and build digests.
              </p>
            </div>

            <ConnectRepositoryForm
              compactIntro
              onSuccess={(id) => {
                pushToast({
                  message: `Repository connected (${id}). First scan queued.`,
                  tone: "pass",
                });
                navigate("/app/pipelines");
              }}
            />

            <div className="pt-4 border-t border-[var(--pg-line)]">
              <div className="pg-label-sm text-[var(--pg-text-muted)] mb-2">
                What runs on connect
              </div>
              <ol className="m-0 pl-4 space-y-1 pg-body-sm text-[var(--pg-text-muted)]">
                <li>Reads workflow files under `.github/workflows`</li>
                <li>Evaluates workflow rules PG-WF-001 through PG-WF-023</li>
                <li>Calculates deterministic risk score and writes audit records</li>
              </ol>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(eventsQuery.isError || pipelinesQuery.isError) && (
        <ErrorPanel
          message={
            eventsQuery.error instanceof Error
              ? eventsQuery.error.message
              : "Unable to load overview telemetry."
          }
          requestId={eventsQuery.error instanceof ApiError ? eventsQuery.error.requestId : null}
          onRetry={() => {
            eventsQuery.refetch();
            pipelinesQuery.refetch();
          }}
        />
      )}

      {/* Top Grid: Ranked Needs Attention + Open Now posture panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7">
          <NeedsAttentionQueue
            rankedEvents={ranked}
            loading={eventsQuery.isLoading}
            onSelectFinding={openDrawer}
          />
        </div>

        <Panel className="lg:col-span-5 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="pg-headline-sm text-[var(--pg-text)] m-0">Open now</h2>
              <p className="pg-body-sm text-[var(--pg-text)] mt-1.5 m-0">
                {criticalCount > 0
                  ? `${criticalCount} critical finding${criticalCount === 1 ? "" : "s"} open across ${Math.max(1, affectedPipelinesCount)} pipeline${affectedPipelinesCount === 1 ? "" : "s"}. Oldest open item is ${oldestAge}.`
                  : openEvents.length > 0
                  ? `${openEvents.length} open findings across ${pipelines.length} connected pipelines.`
                  : `All ${pipelines.length} connected pipelines pass current workflow checks.`}
              </p>
            </div>
            <Button
              variant="primary"
              size="compact"
              onClick={(e) => openConnectDialog(e.currentTarget)}
            >
              Connect repository
            </Button>
          </div>

          {/* Single stacked severity bar with shape + color labels */}
          <div className="space-y-2.5">
            <div
              className="w-full h-2.5 rounded-[4px] overflow-hidden flex bg-[var(--pg-raised)]"
              role="img"
              aria-label={`Open severity distribution: ${criticalCount} critical, ${highCount} high, ${mediumCount} medium, ${lowCount} low`}
            >
              {criticalCount > 0 && (
                <div
                  style={{
                    width: `${(criticalCount / totalOpenForBar) * 100}%`,
                    backgroundColor: "var(--pg-critical)",
                  }}
                />
              )}
              {highCount > 0 && (
                <div
                  style={{
                    width: `${(highCount / totalOpenForBar) * 100}%`,
                    backgroundColor: "var(--pg-high)",
                  }}
                />
              )}
              {mediumCount > 0 && (
                <div
                  style={{
                    width: `${(mediumCount / totalOpenForBar) * 100}%`,
                    backgroundColor: "var(--pg-medium)",
                  }}
                />
              )}
              {lowCount > 0 && (
                <div
                  style={{
                    width: `${(lowCount / totalOpenForBar) * 100}%`,
                    backgroundColor: "var(--pg-low)",
                  }}
                />
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pg-body-sm">
              <div className="flex items-center gap-1.5 text-[var(--pg-critical)]">
                <SeverityShapeIcon shape="diamond" />
                <span className="pg-tnum">{criticalCount} critical</span>
              </div>
              <div className="flex items-center gap-1.5 text-[var(--pg-high)]">
                <SeverityShapeIcon shape="triangle" />
                <span className="pg-tnum">{highCount} high</span>
              </div>
              <div className="flex items-center gap-1.5 text-[var(--pg-medium)]">
                <SeverityShapeIcon shape="square" />
                <span className="pg-tnum">{mediumCount} medium</span>
              </div>
              <div className="flex items-center gap-1.5 text-[var(--pg-low)]">
                <SeverityShapeIcon shape="circle" />
                <span className="pg-tnum">{lowCount} low</span>
              </div>
            </div>
          </div>

          {/* Four plain text stats, not decorative KPI cards */}
          <dl className="grid grid-cols-4 gap-3 pt-4 border-t border-[var(--pg-line)] m-0">
            <div>
              <dt className="pg-label-sm text-[var(--pg-text-muted)]">Open</dt>
              <dd className="pg-headline-sm text-[var(--pg-text)] pg-tnum m-0 mt-0.5">
                {openEvents.length}
              </dd>
            </div>
            <div>
              <dt className="pg-label-sm text-[var(--pg-text-muted)]">Pipelines</dt>
              <dd className="pg-headline-sm text-[var(--pg-text)] pg-tnum m-0 mt-0.5">
                {pipelines.length}
              </dd>
            </div>
            <div>
              <dt className="pg-label-sm text-[var(--pg-text-muted)]">Runs</dt>
              <dd className="pg-headline-sm text-[var(--pg-text)] pg-tnum m-0 mt-0.5">
                {runs.length}
              </dd>
            </div>
            <div>
              <dt className="pg-label-sm text-[var(--pg-text-muted)]">Critical</dt>
              <dd className="pg-headline-sm text-[var(--pg-text)] pg-tnum m-0 mt-0.5">
                {criticalCount}
              </dd>
            </div>
          </dl>
        </Panel>
      </div>

      {/* Run Risk Single-Line Chart (no gradient fill, one series, threshold line, real recorded dates) */}
      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="pg-headline-sm text-[var(--pg-text)] m-0">
              Mean finding risk by date
            </h2>
            <p className="pg-body-sm text-[var(--pg-text-muted)] m-0 mt-0.5">
              Mean risk score across recorded findings against the 70-point CI gate threshold.
            </p>
          </div>
          <div className="pg-data-md text-[var(--pg-text-muted)]">
            {chartData.length === 0
              ? "No timestamped findings yet"
              : chartData.length === 1
              ? `${chartData[0].day}: ${chartData[0].risk}/100`
              : `Start ${chartData[0].risk}/100 · Latest ${chartData[chartData.length - 1].risk}/100`}
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-[180px] flex items-center justify-center rounded-[8px] border border-[var(--pg-line)] bg-[var(--pg-canvas)] pg-body-sm text-[var(--pg-text-muted)]">
            Daily mean risk renders once timestamped findings are recorded.
          </div>
        ) : (
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 12, right: 20, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--pg-line)" vertical={false} />
              <XAxis
                dataKey="day"
                stroke="var(--pg-text-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: "var(--pg-line)" }}
              />
              <YAxis
                domain={[0, 100]}
                stroke="var(--pg-text-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--pg-panel)",
                  borderColor: "var(--pg-line-strong)",
                  borderRadius: "8px",
                  color: "var(--pg-text)",
                  fontSize: "13px",
                }}
              />
              <ReferenceLine
                y={70}
                stroke="var(--pg-high)"
                strokeDasharray="4 4"
                label={{
                  value: "Gate threshold 70",
                  position: "insideTopRight",
                  fill: "var(--pg-high)",
                  fontSize: 11,
                }}
              />
              <Line
                type="monotone"
                dataKey="risk"
                name="Mean risk"
                stroke="var(--pg-primary)"
                strokeWidth={2}
                dot={{ r: 3, fill: "var(--pg-primary)" }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        )}
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
