import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus, Rocket, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { formatDate, getInitials, getStatusColor } from "@/lib/utils";

export default async function OnboardingsPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: currentUser } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", authUser.id)
    .single();

  if (!currentUser) redirect("/login");

  // Fetch active onboarding plans
  const { data: plans } = await supabase
    .from("onboarding_plans")
    .select(`
      *,
      new_hire:users!onboarding_plans_new_hire_id_fkey(full_name, avatar_url, job_title, department),
      manager:users!onboarding_plans_manager_id_fkey(full_name),
      role:roles(title, department)
    `)
    .eq("organization_id", currentUser.organization_id)
    .order("created_at", { ascending: false });

  // Count stats
  const activeCount = plans?.filter((p) => p.status === "active").length || 0;
  const completedCount = plans?.filter((p) => p.status === "completed").length || 0;

  // Get overdue task count
  const { count: overdueCount } = await supabase
    .from("plan_tasks")
    .select("*", { count: "exact", head: true })
    .eq("status", "overdue")
    .in(
      "plan_id",
      (plans || []).filter((p) => p.status === "active").map((p) => p.id)
    );

  // Upcoming check-ins
  const today = new Date().toISOString().split("T")[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { count: upcomingCheckIns } = await supabase
    .from("check_ins")
    .select("*", { count: "exact", head: true })
    .eq("status", "scheduled")
    .gte("scheduled_date", today)
    .lte("scheduled_date", nextWeek);

  const stats = [
    { label: "Active", value: activeCount, icon: Rocket, color: "text-blue-600" },
    { label: "Completed", value: completedCount, icon: CheckCircle2, color: "text-green-600" },
    { label: "Overdue Tasks", value: overdueCount || 0, icon: AlertTriangle, color: "text-red-600" },
    { label: "Check-ins This Week", value: upcomingCheckIns || 0, icon: Clock, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Onboardings</h1>
          <p className="text-muted-foreground">Manage active onboarding journeys</p>
        </div>
        <Link href="/onboardings/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Onboarding
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`rounded-lg bg-muted p-3 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plans List */}
      <div className="space-y-4">
        {!plans || plans.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Rocket className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No onboardings yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Start by creating your first onboarding plan
              </p>
              <Link href="/onboardings/new" className="mt-4">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Onboarding
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          plans.map((plan) => {
            const newHire = plan.new_hire as unknown as {
              full_name: string;
              avatar_url: string | null;
              job_title: string | null;
              department: string | null;
            };
            const manager = plan.manager as unknown as { full_name: string };
            const role = plan.role as unknown as { title: string; department: string } | null;

            return (
              <Link key={plan.id} href={`/onboardings/${plan.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="flex items-center gap-6 p-6">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={newHire.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(newHire.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{newHire.full_name}</h3>
                        <Badge className={getStatusColor(plan.status)} variant="outline">
                          {plan.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {role?.title || newHire.job_title || "Role not set"} &middot;{" "}
                        {role?.department || newHire.department || "Department not set"} &middot;
                        Manager: {manager.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Started {formatDate(plan.start_date)} &middot; Target: {formatDate(plan.target_end_date)}
                      </p>
                    </div>
                    <div className="w-48 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{plan.completion_percentage}%</span>
                      </div>
                      <Progress value={plan.completion_percentage} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
