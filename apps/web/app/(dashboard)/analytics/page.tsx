import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Users, Clock, Target, AlertTriangle } from "lucide-react";
import { AnalyticsCharts } from "@/components/analytics/charts";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: currentUser } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", authUser.id)
    .single();
  if (!currentUser) redirect("/login");

  const orgId = currentUser.organization_id;

  // Aggregate stats
  const { count: totalPlans } = await supabase
    .from("onboarding_plans")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId);

  const { count: activePlans } = await supabase
    .from("onboarding_plans")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "active");

  const { count: completedPlans } = await supabase
    .from("onboarding_plans")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "completed");

  const { data: allActivePlans } = await supabase
    .from("onboarding_plans")
    .select("id, completion_percentage")
    .eq("organization_id", orgId)
    .eq("status", "active");

  const avgCompletion = allActivePlans && allActivePlans.length > 0
    ? Math.round(allActivePlans.reduce((sum, p) => sum + p.completion_percentage, 0) / allActivePlans.length)
    : 0;

  const { count: overdueTasksCount } = await supabase
    .from("plan_tasks")
    .select("*", { count: "exact", head: true })
    .eq("status", "overdue")
    .in("plan_id", (allActivePlans || []).map((p) => p.id));

  // Metrics for charts
  const { data: metrics } = await supabase
    .from("ramp_metrics")
    .select("*")
    .eq("organization_id", orgId)
    .order("recorded_date", { ascending: true })
    .limit(500);

  // Plan details for department breakdown
  const { data: plansWithRoles } = await supabase
    .from("onboarding_plans")
    .select("id, completion_percentage, status, role:roles(department)")
    .eq("organization_id", orgId);

  const departmentStats = new Map<string, { active: number; completed: number; avgCompletion: number; total: number }>();
  for (const plan of plansWithRoles || []) {
    const dept = (plan.role as unknown as { department: string } | null)?.department || "Unknown";
    if (!departmentStats.has(dept)) {
      departmentStats.set(dept, { active: 0, completed: 0, avgCompletion: 0, total: 0 });
    }
    const stats = departmentStats.get(dept)!;
    stats.total++;
    if (plan.status === "active") stats.active++;
    if (plan.status === "completed") stats.completed++;
    stats.avgCompletion += plan.completion_percentage;
  }

  const deptData = Array.from(departmentStats.entries()).map(([dept, stats]) => ({
    department: dept,
    active: stats.active,
    completed: stats.completed,
    avgCompletion: stats.total > 0 ? Math.round(stats.avgCompletion / stats.total) : 0,
  }));

  const stats = [
    { label: "Total Onboardings", value: totalPlans || 0, icon: Users, color: "text-blue-600" },
    { label: "Currently Active", value: activePlans || 0, icon: Target, color: "text-green-600" },
    { label: "Completed", value: completedPlans || 0, icon: TrendingUp, color: "text-purple-600" },
    { label: "Avg. Completion", value: `${avgCompletion}%`, icon: BarChart3, color: "text-indigo-600" },
    { label: "Overdue Tasks", value: overdueTasksCount || 0, icon: AlertTriangle, color: "text-red-600" },
    { label: "Completion Rate", value: totalPlans ? `${Math.round(((completedPlans || 0) / totalPlans) * 100)}%` : "0%", icon: Clock, color: "text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Ramp-up metrics and onboarding performance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 text-center">
              <stat.icon className={`mx-auto h-6 w-6 ${stat.color}`} />
              <p className="mt-2 text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <AnalyticsCharts metrics={metrics || []} departmentData={deptData} />
    </div>
  );
}
