import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAuditLogs,
  getSecurityEvents,
  updateSecurityEventStatus,
  type ApiSecurityEvent,
} from "../../services/api";
import { SEVERITY_META } from "../../rules/severity";
import type { FindingStatus } from "../../rules/schemas";

export function useFindingsQuery() {
  return useQuery({
    queryKey: ["events"],
    queryFn: getSecurityEvents,
  });
}

export function useAuditLogsQuery() {
  return useQuery({
    queryKey: ["auditLogs"],
    queryFn: getAuditLogs,
  });
}

export function useUpdateFindingStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      status,
    }: {
      eventId: string;
      status: FindingStatus;
      previousStatus?: string;
    }) => {
      return updateSecurityEventStatus(eventId, status);
    },
    onMutate: async ({ eventId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["events"] });
      const previous = queryClient.getQueryData<ApiSecurityEvent[]>(["events"]);
      if (previous) {
        queryClient.setQueryData<ApiSecurityEvent[]>(
          ["events"],
          previous.map((evt) =>
            evt.event_id === eventId ? { ...evt, status } : evt
          )
        );
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["events"], ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["auditLogs"] });
    },
  });
}

/**
 * Ranks open/investigating findings strictly by severity first, then age (oldest first),
 * so the ordering can always be explained in one sentence.
 */
export function rankNeedsAttention(events: readonly ApiSecurityEvent[]): ApiSecurityEvent[] {
  return [...events]
    .filter((e) => e.status === "OPEN" || e.status === "INVESTIGATING")
    .sort((a, b) => {
      const sa = SEVERITY_META[(a.severity || "INFO").toUpperCase() as keyof typeof SEVERITY_META]?.order ?? 99;
      const sb = SEVERITY_META[(b.severity || "INFO").toUpperCase() as keyof typeof SEVERITY_META]?.order ?? 99;
      if (sa !== sb) return sa - sb;
      const ta = Date.parse(a.timestamp || a.created_at || "") || 0;
      const tb = Date.parse(b.timestamp || b.created_at || "") || 0;
      return ta - tb; // Oldest first
    });
}
