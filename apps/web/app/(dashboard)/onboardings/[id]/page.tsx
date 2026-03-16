import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Circle, Clock, AlertTriangle, Calendar, Users, BarChart3 } from "lucide-react";
import { formatDate, formatRelativeDate, getInitials, getStatusColor, calculateDayNumber } from "@/lib/utils";
import { TaskList } from "@/components/onboarding/task-list";
import { CheckInList } from "@/components/onboarding/check-in-list";
import { ProgressChart } from "@/components/onboarding/progress-chart";
import type { PlanPhase } from "@rampup/supabase";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OnboardingDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: plan } = await supabase
    .from("onboarding_plans")
    .select(`
      *,
      new_hire:users!onboarding_plans_new_hire_id_fkey(id, full_name, avatar_url, email, job_title, department, start_date),
      manager:users!onboarding_plans_manager_id_fkey(id, full_name, avatar_url),
      buddy:users!onboarding_plans_buddy_id_fkey(id, full_name, avatar_url),
      role:roles(title, department, level)
    `)
    .eq("id", id)
    .single();

  if (!plan) notFound();

  const newHire = plan.new_hire as unknown as {
    id: string; full_name: string; avatar_url: string | null; email: string;
    job_title: string | null; department: string | null; start_date: string | null;
  };
  const manager = plan.manager as unknown as { id: string; full_name: string; avatar_url: string | null };
  const buddy = plan.buddy as unknown as { id: string; full_name: string; avatar_url: string | null } | null;
  const role = plan.role as unknown as { title: string; department: string; level: string | null } | null;
  const phases = plan.phases as PlanPhase[];

  // Fetch tasks
  const { data: tasks } = await supabase
    .from("plan_tasks")
    .select("*")
    .eq("plan_id", id)
    .order("due_date", { ascending: true })
    .order("sort_order", { ascending: true });

  // Fetch check-ins
  const { data: checkIns } = await supabase
    .from("check_ins")
    .select("*")
    .eq("plan_id", id)
    .order("scheduled_date", { ascending: true });

  // Fetch metrics
  const { data: metrics } = await supabase
    .from("ramp_metrics")
    .select("*")
    .eq("plan_id", id)
    .order("recorded_date", { ascending: true });

  const dayNumber = calculateDayNumber(plan.start_date);
  const totalTasks = tasks?.length || 0;
  const completedTasks = tasks?.filter((t) => t.status === "completed").length || 0;
  const overdueTasks = tasks?.filter((t) => t.status === "overdue").length || 0;
  const todayTasks = tasks?.filter(
    (t) => t.due_date === new Date().toISOString().split("T")[0] && t.status !== "completed"
  ).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={newHire.avatar_url || undefined} />
            <AvatarFallback className="text-lg">{getInitials(newHire.full_name)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{newHire.full_name}</h1>
              <Badge className={getStatusColor(plan.status)}>{plan.status}</Badge>
              {plan.ai_generated && (
                <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
                  AI Generated
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {role?.title || newHire.job_title || "Role not set"} &middot;{" "}
              {role?.department || newHire.department || ""} &middot; Day {dayNumber}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatDate(plan.start_date)} - {formatDate(plan.target_end_date)}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{plan.completion_percentage}%</p>
            <p className="text-xs text-muted-foreground">Overall Progress</p>
            <Progress value={plan.completion_percentage} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold">{completedTasks}/{totalTasks}</p>
              <p className="text-xs text-muted-foreground">Tasks Done</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold">{todayTasks}</p>
              <p className="text-xs text-muted-foreground">Due Today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div>
              <p className="text-2xl font-bold">{overdueTasks}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Calendar className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-2xl font-bold">Day {dayNumber}</p>
              <p className="text-xs text-muted-foreground">of {Math.ceil((new Date(plan.target_end_date).getTime() - new Date(plan.start_date).getTime()) / (1000 * 60 * 60 * 24))}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* People */}
      <Card>
        <CardContent className="flex items-center gap-8 p-4">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={manager.avatar_url || undefined} />
              <AvatarFallback className="text-xs">{getInitials(manager.full_name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{manager.full_name}</p>
              <p className="text-xs text-muted-foreground">Manager</p>
            </div>
          </div>
          {buddy && (
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={buddy.avatar_url || undefined} />
                <AvatarFallback className="text-xs">{getInitials(buddy.full_name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{buddy.full_name}</p>
                <p className="text-xs text-muted-foreground">Buddy</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phases */}
      {phases.length > 0 && (
        <div className="flex gap-2">
          {phases.map((phase) => {
            const isActive = dayNumber >= phase.start_day && dayNumber <= phase.end_day;
            const isCompleted = dayNumber > phase.end_day;
            return (
              <div
                key={phase.name}
                className={`flex-1 rounded-lg border p-3 ${
                  isActive ? "border-primary bg-primary/5" : isCompleted ? "border-green-200 bg-green-50" : "bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : isActive ? (
                    <Circle className="h-4 w-4 fill-primary text-primary" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">{phase.name}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Days {phase.start_day}-{phase.end_day}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="checkins">Check-ins</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <TaskList tasks={tasks || []} planId={id} />
        </TabsContent>

        <TabsContent value="checkins">
          <CheckInList checkIns={checkIns || []} planId={id} />
        </TabsContent>

        <TabsContent value="progress">
          <ProgressChart metrics={metrics || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
