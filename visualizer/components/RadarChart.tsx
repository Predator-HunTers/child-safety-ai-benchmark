"use client";

import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

export function RadarChart({
  data,
  models,
}: {
  data: Array<Record<string, string | number>>;
  models: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <RechartsRadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
        <PolarRadiusAxis angle={90} domain={[0, 1]} tick={{ fontSize: 10 }} />
        {models.map((model, i) => (
          <Radar
            key={model}
            name={model}
            dataKey={model}
            stroke={COLORS[i % COLORS.length]}
            fill={COLORS[i % COLORS.length]}
            fillOpacity={0.1}
          />
        ))}
        <Legend />
      </RechartsRadarChart>
    </ResponsiveContainer>
  );
}
