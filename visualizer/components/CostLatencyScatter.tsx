"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Label,
} from "recharts";

interface ScatterPoint {
  model: string;
  avg_latency_ms: number;
  total_cost_usd: number;
  f1: number;
}

export function CostLatencyScatter({ data }: { data: ScatterPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <ScatterChart margin={{ bottom: 20, left: 20, right: 20, top: 10 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="avg_latency_ms"
          name="Latency"
          unit="ms"
        >
          <Label value="Average Latency (ms)" position="bottom" offset={0} />
        </XAxis>
        <YAxis
          type="number"
          dataKey="total_cost_usd"
          name="Cost"
          unit="$"
        >
          <Label value="Total Cost ($)" angle={-90} position="left" offset={0} />
        </YAxis>
        <Tooltip
          content={({ payload }) => {
            if (!payload || payload.length === 0) return null;
            const d = payload[0].payload as ScatterPoint;
            return (
              <div className="rounded-lg border bg-card p-3 shadow-lg">
                <p className="font-medium">{d.model}</p>
                <p className="text-sm">
                  Latency: {d.avg_latency_ms.toFixed(0)}ms
                </p>
                <p className="text-sm">
                  Cost: ${d.total_cost_usd.toFixed(4)}
                </p>
                <p className="text-sm">
                  F1: {(d.f1 * 100).toFixed(1)}%
                </p>
              </div>
            );
          }}
        />
        <Scatter
          data={data}
          fill="#3b82f6"
          shape={((props: unknown) => {
            const { cx, cy, payload } = props as { cx: number; cy: number; payload: ScatterPoint };
            const size = 8 + payload.f1 * 20;
            return (
              <g>
                <circle
                  cx={cx}
                  cy={cy}
                  r={size}
                  fill="#3b82f6"
                  fillOpacity={0.6}
                  stroke="#2563eb"
                  strokeWidth={1}
                />
                <text
                  x={cx}
                  y={cy - size - 4}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#6b7280"
                >
                  {payload.model}
                </text>
              </g>
            );
          })}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
