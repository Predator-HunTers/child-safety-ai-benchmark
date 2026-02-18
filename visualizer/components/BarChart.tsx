"use client";

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { CategoryMetrics } from "@/lib/types";

const COLORS: Record<string, string> = {
  age_probing: "#3b82f6",
  trust_building: "#22c55e",
  isolation: "#f59e0b",
  location_probing: "#ef4444",
  contact_escalation: "#8b5cf6",
  explicit_solicitation: "#ec4899",
  meeting_requests: "#06b6d4",
  coercion_threats: "#f97316",
  safe: "#94a3b8",
};

export function BarChart({
  categories,
}: {
  categories: Record<string, CategoryMetrics>;
}) {
  const data = Object.entries(categories)
    .map(([name, metrics]) => ({
      name,
      f1: metrics.f1,
      precision: metrics.precision,
      recall: metrics.recall,
      count: metrics.count,
    }))
    .sort((a, b) => b.f1 - a.f1);

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 font-semibold">Detection Score by Category</h3>
      <ResponsiveContainer width="100%" height={300}>
        <RechartsBarChart
          data={data}
          layout="vertical"
          margin={{ left: 120, right: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, "Detection Score"]}
          />
          <Bar dataKey="f1" name="Detection Score" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={COLORS[entry.name] ?? "#6b7280"}
              />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
