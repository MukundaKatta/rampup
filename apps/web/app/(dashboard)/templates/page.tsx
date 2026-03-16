import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, LayoutTemplate, Calendar, ListChecks } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { PlanPhase } from "@rampup/supabase";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: currentUser } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", authUser.id)
    .single();
  if (!currentUser) redirect("/login");

  const { data: templates } = await supabase
    .from("onboarding_templates")
    .select(`
      *,
      role:roles(title, department),
      template_tasks(id),
      created_by_user:users!onboarding_templates_created_by_fkey(full_name)
    `)
    .eq("organization_id", currentUser.organization_id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground">Onboarding plan templates by role</p>
        </div>
        <Link href="/templates/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </Link>
      </div>

      {!templates || templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <LayoutTemplate className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No templates yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create reusable onboarding templates for different roles
            </p>
            <Link href="/templates/new" className="mt-4">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const roleData = template.role as unknown as { title: string; department: string } | null;
            const taskCount = (template.template_tasks as unknown as { id: string }[])?.length || 0;
            const phases = template.phases as PlanPhase[];
            const createdBy = template.created_by_user as unknown as { full_name: string } | null;

            return (
              <Link key={template.id} href={`/templates/${template.id}`}>
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <CardDescription>{template.description || "No description"}</CardDescription>
                      </div>
                      {template.is_default && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {roleData && (
                      <Badge variant="outline">
                        {roleData.title} - {roleData.department}
                      </Badge>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {template.duration_days} days
                      </span>
                      <span className="flex items-center gap-1">
                        <ListChecks className="h-4 w-4" />
                        {taskCount} tasks
                      </span>
                    </div>
                    {phases.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {phases.map((phase) => (
                          <Badge key={phase.name} variant="outline" className="text-xs">
                            {phase.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(template.created_at)}
                      {createdBy ? ` by ${createdBy.full_name}` : ""}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
