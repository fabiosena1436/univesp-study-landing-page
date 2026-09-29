"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AttemptRow } from "@/lib/types";

export function PerformanceChart({ attempts }: { attempts: AttemptRow[] }) {
  const data = [...attempts]
    .reverse()
    .slice(-8)
    .map((attempt, index) => ({
      name: `Prova ${index + 1}`,
      score: Math.round((attempt.correctCount / Math.max(1, attempt.total)) * 100),
      subject: attempt.subjectName,
    }));

  if (data.length === 0) return null;

  return (
    <div className="card p-5 md:p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Seu ritmo</p>
          <h2 className="font-display text-xl font-semibold mt-1">Evolução nas provas</h2>
        </div>
        <span className="rounded-full bg-green-soft text-green text-xs font-bold px-2.5 py-1">
          {data[data.length - 1].score}% na última
        </span>
      </div>
      <div className="h-56 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="performance-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.24} />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e3e8f1" strokeDasharray="4 4" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#8490a7", fontSize: 11 }} />
            <YAxis
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#8490a7", fontSize: 11 }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              cursor={{ stroke: "#cbd4e3", strokeDasharray: "4 4" }}
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <div className="rounded-xl border border-line bg-card px-3 py-2 shadow-lg">
                    <p className="text-xs text-muted">{payload[0].payload.subject}</p>
                    <p className="text-sm font-bold text-pen">{payload[0].value}% de acertos</p>
                  </div>
                ) : null
              }
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#4f46e5"
              strokeWidth={3}
              fill="url(#performance-fill)"
              dot={{ r: 4, fill: "#ffffff", stroke: "#4f46e5", strokeWidth: 2 }}
              activeDot={{ r: 6, fill: "#4f46e5", stroke: "#ffffff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
