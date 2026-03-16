"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { RampMetric } from "@/types";

interface ProgressChartProps {
  metrics: RampMetric[];
}

export function ProgressChart({ metrics }: ProgressChartProps) {
  if (metrics.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No progress data recorded yet. Metrics are captured daily for active onboardings.
        </CardContent>
      </Card>
    );
  }

  const chartData = metrics.map((m) => ({
    day: `Day ${m.day_number}`,
    dayNumber: m.day_number,
    completion: m.completion_percentage,
    expected: Math.min(100, Math.round((m.day_number / 90) * 100)),
    engagement: m.engagement_score || null,
  }));

  return (
    <div className="space-y-6">
      {/* Completion Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Completion Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="completion"
                  stroke="hsl(var(--primary))"
                  name="Actual"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="expected"
                  stroke="hsl(var(--muted-foreground))"
                  name="Expected"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">
              {metrics.length > 0 ? metrics[metrics.length - 1].tasks_completed : 0}
            </p>
            <p className="text-xs text-muted-foreground">Tasks Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">
              {metrics.length > 0 ? metrics[metrics.length - 1].day_number : 0}
            </p>
            <p className="text-xs text-muted-foreground">Days In</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${metrics.length > 0 && metrics[metrics.length - 1].on_track ? "text-green-600" : "text-red-600"}`}>
              {metrics.length > 0 && metrics[metrics.length - 1].on_track ? "On Track" : "At Risk"}
            </p>
            <p className="text-xs text-muted-foreground">Current Status</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
