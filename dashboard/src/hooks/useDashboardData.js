import { useState, useEffect, useCallback } from "react";
import {
  getBackendHealth,
  getPipelines,
  createPipeline,
  getRuns,
  getSecurityEvents,
  getAuditLogs,
  updateSecurityEventStatus,
} from "../services/api";

export function useDashboardData() {
  const [health, setHealth] = useState({ status: "checking", timestamp: null });
  const [pipelines, setPipelines] = useState([]);
  const [runs, setRuns] = useState([]);
  const [events, setEvents] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAllData = useCallback(async () => {
    try {
      const [hRes, pRes, rRes, eRes, aRes] = await Promise.allSettled([
        getBackendHealth(),
        getPipelines(),
        getRuns(),
        getSecurityEvents(),
        getAuditLogs(),
      ]);

      if (hRes.status === "fulfilled") setHealth(hRes.value);
      else setHealth({ status: "offline", error: hRes.reason?.message });

      if (pRes.status === "fulfilled") setPipelines(pRes.value || []);
      if (rRes.status === "fulfilled") setRuns(rRes.value || []);
      if (eRes.status === "fulfilled") setEvents(eRes.value || []);
      if (aRes.status === "fulfilled") setAuditLogs(aRes.value || []);

      setError(null);
    } catch (err) {
      setError(err.message || "Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAddPipeline = async (pipelineData) => {
    const newPipe = await createPipeline(pipelineData);
    setPipelines((prev) => [newPipe, ...prev]);
    return newPipe;
  };

  const handleUpdateStatus = async (eventId, newStatus) => {
    try {
      await updateSecurityEventStatus(eventId, newStatus);
      // Optimistically update local events
      setEvents((prev) =>
        prev.map((evt) =>
          evt.event_id === eventId || evt.id === eventId
            ? { ...evt, status: newStatus }
            : evt
        )
      );
      // Refresh audit logs
      try {
        const freshLogs = await getAuditLogs();
        setAuditLogs(freshLogs);
      } catch (_) {}
      return true;
    } catch (err) {
      console.error("Status update error:", err);
      throw err;
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 10000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  return {
    health,
    pipelines,
    runs,
    events,
    auditLogs,
    loading,
    error,
    refresh: fetchAllData,
    addPipeline: handleAddPipeline,
    updateEventStatus: handleUpdateStatus,
  };
}
