"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import type { RampMetric } from "@/types";

interface AnalyticsChartsProps {
  metrics: RampMetric[];
  departmentData: Array<{
    department: string;
    active: number;
    completed: number;
    avgCompletion: number;
  }>;
}

const COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export function AnalyticsCharts({ metrics, departmentData }: AnalyticsChartsProps) {
  // Aggregate metrics by date for overall trends
  const dateMap = new Map<string, { completion: number; count: number; onTrack: number }>();
  for (const m of metrics) {
    const existing = dateMap.get(m.recorded_date) || { completion: 0, count: 0, onTrack: 0 };
    existing.completion += m.completion_percentage;
    existing.count += 1;
    existing.on_track && (existing.onTrack += 1);
    dateMap.set(m.recorded_date, existing);
  }

  const trendData = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, data]) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      avgCompletion: Math.round(data.completion / data.count),
      activePlans: data.count,
    }));

  return (
    <div className="space-y-6">
      {/* Completion Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Completion Trend (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {trendData.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No trend data available yet. Metrics are recorded daily for active onboardings.
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
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
                    dataKey="avgCompletion"
                    stroke="#4f46e5"
                    name="Avg Completion %"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="activePlans"
                    stroke="#10b981"
                    name="Active Plans"
                    strokeWidth={2}
                    yAxisId={0}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Department Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Department</CardTitle>
          </CardHeader>
          <CardContent>
            {departmentData.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No department data</div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="active" fill="#4f46e5" name="Active" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" fill="#10b981" name="Completed" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completion Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Avg. Completion by Department</CardTitle>
          </CardHeader>
          <CardContent>
            {departmentData.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No data available</div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={departmentData.map((d) => ({ name: d.department, value: d.avgCompletion }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}%`}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {departmentData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
