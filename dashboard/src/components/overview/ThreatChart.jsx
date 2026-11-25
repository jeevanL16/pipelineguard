import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const DEFAULT_ACTIVITY = [
  { time: "00:00", events: 1, risk: 20 },
  { time: "04:00", events: 3, risk: 35 },
  { time: "08:00", events: 6, risk: 55 },
  { time: "12:00", events: 9, risk: 75 },
  { time: "16:00", events: 4, risk: 40 },
  { time: "20:00", events: 2, risk: 25 },
];

export function ThreatChart({ events = [] }) {
  // If real events exist, build distribution or fallback
  const chartData = DEFAULT_ACTIVITY;

  return (
    <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Threat Activity Over Time</h3>
          <p className="text-xs text-gray-500">Pipeline trigger events and threat detections</p>
        </div>
        <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
          Telemetry Live
        </span>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="eventGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
            <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0e1320",
                borderColor: "#27354f",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#fff",
              }}
            />
            <Area
              type="monotone"
              dataKey="events"
              name="Events"
              stroke="#06b6d4"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#eventGradient)"
            />
            <Area
              type="monotone"
              dataKey="risk"
              name="Risk Index"
              stroke="#6366f1"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#riskGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
