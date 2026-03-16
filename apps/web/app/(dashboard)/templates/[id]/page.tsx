import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calendar, ListChecks, BookOpen, Users, Settings, GraduationCap, Briefcase, Coffee, CheckCircle, Star } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { PlanPhase } from "@rampup/supabase";
import Link from "next/link";

const taskTypeIcons: Record<string, React.ReactNode> = {
  reading: <BookOpen className="h-4 w-4" />,
  meeting: <Users className="h-4 w-4" />,
  setup: <Settings className="h-4 w-4" />,
  training: <GraduationCap className="h-4 w-4" />,
  project: <Briefcase className="h-4 w-4" />,
  social: <Coffee className="h-4 w-4" />,
  review: <CheckCircle className="h-4 w-4" />,
  custom: <Star className="h-4 w-4" />,
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TemplateDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: template } = await supabase
    .from("onboarding_templates")
    .select(`
      *,
      role:roles(title, department),
      template_tasks(*),
      created_by_user:users!onboarding_templates_created_by_fkey(full_name)
    `)
    .eq("id", id)
    .single();

  if (!template) notFound();

  const roleData = template.role as unknown as { title: string; department: string } | null;
  const tasks = (template.template_tasks as unknown as Array<{
    id: string; title: string; description: string | null; task_type: string;
    day_offset: number; duration_minutes: number | null; is_required: boolean;
    assignee_role: string | null; sort_order: number;
  }>) || [];
  const phases = template.phases as PlanPhase[];
  const createdBy = template.created_by_user as unknown as { full_name: string } | null;

  // Group tasks by phase
  const tasksByPhase = new Map<string, typeof tasks>();
  for (const task of tasks.sort((a, b) => a.day_offset - b.day_offset)) {
    const phase = phases.find((p) => task.day_offset >= p.start_day && task.day_offset <= p.end_day);
    const phaseName = phase?.name || "Other";
    if (!tasksByPhase.has(phaseName)) tasksByPhase.set(phaseName, []);
    tasksByPhase.get(phaseName)!.push(task);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{template.name}</h1>
          {template.description && (
            <p className="mt-1 text-muted-foreground">{template.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3">
            {roleData && (
              <Badge variant="outline">{roleData.title} - {roleData.department}</Badge>
            )}
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />{template.duration_days} days
            </span>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <ListChecks className="h-4 w-4" />{tasks.length} tasks
            </span>
            {createdBy && (
              <span className="text-sm text-muted-foreground">
                Created by {createdBy.full_name} on {formatDate(template.created_at)}
              </span>
            )}
          </div>
        </div>
        <Link href={`/onboardings/new?template=${template.id}`}>
          <Button>Use Template</Button>
        </Link>
      </div>

      {/* Phases */}
      <div className="grid gap-4 md:grid-cols-4">
        {phases.map((phase) => (
          <Card key={phase.name}>
            <CardContent className="p-4">
              <h3 className="font-semibold">{phase.name}</h3>
              <p className="text-xs text-muted-foreground">Days {phase.start_day}-{phase.end_day}</p>
              <p className="mt-1 text-sm text-muted-foreground">{phase.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {tasksByPhase.get(phase.name)?.length || 0} tasks
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tasks by Phase */}
      {Array.from(tasksByPhase.entries()).map(([phaseName, phaseTasks]) => (
        <div key={phaseName}>
          <h2 className="mb-3 text-lg font-semibold">{phaseName}</h2>
          <div className="space-y-2">
            {phaseTasks.map((task) => (
              <Card key={task.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <span className="text-muted-foreground">
                    {taskTypeIcons[task.task_type] || <Star className="h-4 w-4" />}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{task.title}</span>
                      <Badge variant="outline" className="text-xs">{task.task_type}</Badge>
                      {task.is_required && <Badge variant="outline" className="text-xs">Required</Badge>}
                    </div>
                    {task.description && (
                      <p className="text-sm text-muted-foreground">{task.description}</p>
                    )}
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>Day {task.day_offset}</p>
                    {task.duration_minutes && <p>{task.duration_minutes} min</p>}
                    {task.assignee_role && <p className="capitalize">{task.assignee_role.replace("_", " ")}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
