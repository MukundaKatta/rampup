"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BookOpen, Users, Settings, GraduationCap, Briefcase, Coffee, CheckCircle, Star, Circle,
  ExternalLink, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import { formatRelativeDate, getStatusColor } from "@/lib/utils";
import type { PlanTask } from "@/types";

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

interface TaskListProps {
  tasks: PlanTask[];
  planId: string;
}

export function TaskList({ tasks, planId }: TaskListProps) {
  const [filter, setFilter] = useState<string>("all");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  const phases = Array.from(new Set(tasks.map((t) => t.phase_name).filter(Boolean)));

  const filteredTasks = tasks.filter((task) => {
    if (filter !== "all" && task.status !== filter) return false;
    if (phaseFilter !== "all" && task.phase_name !== phaseFilter) return false;
    return true;
  });

  async function toggleTaskCompletion(taskId: string, currentStatus: string) {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    const now = new Date().toISOString();

    await supabase
      .from("plan_tasks")
      .update({
        status: newStatus,
        completed_at: newStatus === "completed" ? now : null,
      })
      .eq("id", taskId);

    if (newStatus === "completed") {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("task_completions").insert({
          task_id: taskId,
          plan_id: planId,
          completed_by: user.id,
        });
      }
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>

        <Select value={phaseFilter} onValueChange={setPhaseFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Phase" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Phases</SelectItem>
            {phases.map((phase) => (
              <SelectItem key={phase} value={phase!}>
                {phase}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />
        <p className="self-center text-sm text-muted-foreground">
          {filteredTasks.length} of {tasks.length} tasks
        </p>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No tasks match the selected filters.
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map((task) => (
            <Card
              key={task.id}
              className={`transition-colors ${task.status === "completed" ? "opacity-60" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="pt-0.5">
                    <Checkbox
                      checked={task.status === "completed"}
                      onCheckedChange={() => toggleTaskCompletion(task.id, task.status)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {taskTypeIcons[task.task_type] || <Circle className="h-4 w-4" />}
                      </span>
                      <span
                        className={`font-medium ${task.status === "completed" ? "line-through" : ""}`}
                      >
                        {task.title}
                      </span>
                      <Badge variant="outline" className={getStatusColor(task.status)}>
                        {task.status.replace("_", " ")}
                      </Badge>
                      {task.is_required && (
                        <Badge variant="outline" className="text-xs">
                          Required
                        </Badge>
                      )}
                      {task.is_ai_generated && (
                        <Badge variant="outline" className="border-purple-200 text-purple-600 text-xs">
                          AI
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Due: {formatRelativeDate(task.due_date)}</span>
                      {task.duration_minutes && <span>{task.duration_minutes} min</span>}
                      {task.phase_name && <span>{task.phase_name}</span>}
                    </div>
                    {expandedTask === task.id && (
                      <div className="mt-3 space-y-2">
                        {task.description && (
                          <p className="text-sm text-muted-foreground">{task.description}</p>
                        )}
                        {(task.resources as Array<{ url: string; title: string }>)?.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {(task.resources as Array<{ url: string; title: string }>).map((r, i) => (
                              <a
                                key={i}
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs hover:bg-muted/80"
                              >
                                <ExternalLink className="h-3 w-3" />
                                {r.title}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                  >
                    {expandedTask === task.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
