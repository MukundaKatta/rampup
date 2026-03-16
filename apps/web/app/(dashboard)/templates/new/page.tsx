"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface TaskEntry {
  title: string;
  description: string;
  taskType: string;
  dayOffset: number;
  durationMinutes: number;
  isRequired: boolean;
  assigneeRole: string;
}

export default function NewTemplatePage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roles, setRoles] = useState<Array<{ id: string; title: string; department: string }>>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [roleId, setRoleId] = useState("");
  const [durationDays, setDurationDays] = useState(90);
  const [tasks, setTasks] = useState<TaskEntry[]>([
    { title: "", description: "", taskType: "setup", dayOffset: 1, durationMinutes: 30, isRequired: true, assigneeRole: "new_hire" },
  ]);

  useEffect(() => {
    async function loadRoles() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: currentUser } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
      if (!currentUser) return;
      const { data } = await supabase.from("roles").select("id, title, department").eq("organization_id", currentUser.organization_id).eq("is_active", true);
      setRoles(data || []);
    }
    loadRoles();
  }, [supabase]);

  function addTask() {
    setTasks([...tasks, {
      title: "", description: "", taskType: "custom", dayOffset: tasks.length + 1,
      durationMinutes: 30, isRequired: true, assigneeRole: "new_hire",
    }]);
  }

  function removeTask(index: number) {
    setTasks(tasks.filter((_, i) => i !== index));
  }

  function updateTask(index: number, field: keyof TaskEntry, value: string | number | boolean) {
    const updated = [...tasks];
    (updated[index] as Record<string, unknown>)[field] = value;
    setTasks(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: currentUser } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
      if (!currentUser) throw new Error("User not found");

      const phases = [
        { name: "Orientation", start_day: 1, end_day: 14, description: "Setup, meet the team, review core docs" },
        { name: "Learning", start_day: 15, end_day: 30, description: "Shadow sessions, training, first small tasks" },
        { name: "Contributing", start_day: 31, end_day: 60, description: "Independent work, first project" },
        { name: "Ownership", start_day: 61, end_day: durationDays, description: "Full ownership, first review" },
      ];

      const { data: template, error: templateError } = await supabase
        .from("onboarding_templates")
        .insert({
          organization_id: currentUser.organization_id,
          role_id: roleId || null,
          name,
          description: description || null,
          duration_days: durationDays,
          phases,
          created_by: user.id,
        })
        .select()
        .single();

      if (templateError || !template) throw new Error(templateError?.message || "Failed to create template");

      // Insert tasks
      const validTasks = tasks.filter((t) => t.title.trim());
      if (validTasks.length > 0) {
        const { error: tasksError } = await supabase.from("template_tasks").insert(
          validTasks.map((t, i) => ({
            template_id: template.id,
            title: t.title,
            description: t.description || null,
            task_type: t.taskType,
            day_offset: t.dayOffset,
            duration_minutes: t.durationMinutes,
            is_required: t.isRequired,
            assignee_role: t.assigneeRole,
            sort_order: i,
          }))
        );
        if (tasksError) throw new Error(tasksError.message);
      }

      router.push("/templates");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Template</h1>
        <p className="text-muted-foreground">Create a reusable onboarding plan template</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Frontend Engineer Onboarding" required />
              </div>
              <div className="space-y-2">
                <Label>Role (optional)</Label>
                <Select value={roleId} onValueChange={setRoleId}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.title} ({r.department})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Onboarding plan for frontend engineers..." />
            </div>
            <div className="space-y-2">
              <Label>Duration (days)</Label>
              <Input type="number" min={30} max={180} value={durationDays} onChange={(e) => setDurationDays(parseInt(e.target.value))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Tasks</CardTitle>
                <CardDescription>Define the tasks for this template</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addTask}>
                <Plus className="mr-1 h-4 w-4" />Add Task
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {tasks.map((task, index) => (
              <div key={index} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Task {index + 1}</span>
                  {tasks.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeTask(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Title</Label>
                    <Input value={task.title} onChange={(e) => updateTask(index, "title", e.target.value)} placeholder="Set up development environment" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Day</Label>
                      <Input type="number" min={1} max={durationDays} value={task.dayOffset} onChange={(e) => updateTask(index, "dayOffset", parseInt(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select value={task.taskType} onValueChange={(v) => updateTask(index, "taskType", v)}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["reading", "meeting", "setup", "training", "project", "social", "review", "custom"].map((t) => (
                            <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Assignee</Label>
                      <Select value={task.assigneeRole} onValueChange={(v) => updateTask(index, "assigneeRole", v)}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["new_hire", "manager", "buddy", "it"].map((r) => (
                            <SelectItem key={r} value={r} className="text-xs">{r.replace("_", " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input value={task.description} onChange={(e) => updateTask(index, "description", e.target.value)} placeholder="Detailed instructions..." />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Template
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
