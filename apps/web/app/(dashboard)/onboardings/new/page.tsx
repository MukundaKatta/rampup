"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";

interface TeamMember {
  id: string;
  full_name: string;
  role: string;
}

interface RoleOption {
  id: string;
  title: string;
  department: string;
}

interface TemplateOption {
  id: string;
  name: string;
  role_id: string | null;
}

export default function NewOnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);

  const [formData, setFormData] = useState({
    newHireEmail: "",
    newHireName: "",
    managerId: "",
    buddyId: "",
    roleId: "",
    templateId: "",
    startDate: new Date().toISOString().split("T")[0],
    notes: "",
    useAi: true,
  });

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: currentUser } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (!currentUser) return;

      const [membersRes, rolesRes, templatesRes] = await Promise.all([
        supabase
          .from("users")
          .select("id, full_name, role")
          .eq("organization_id", currentUser.organization_id)
          .eq("is_active", true)
          .order("full_name"),
        supabase
          .from("roles")
          .select("id, title, department")
          .eq("organization_id", currentUser.organization_id)
          .eq("is_active", true)
          .order("title"),
        supabase
          .from("onboarding_templates")
          .select("id, name, role_id")
          .eq("organization_id", currentUser.organization_id)
          .order("name"),
      ]);

      setTeamMembers(membersRes.data || []);
      setRoles(rolesRes.data || []);
      setTemplates(templatesRes.data || []);
    }
    loadData();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: currentUser } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (!currentUser) throw new Error("User profile not found");

      // Create or find new hire user
      let newHireId: string;
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", formData.newHireEmail)
        .eq("organization_id", currentUser.organization_id)
        .single();

      if (existingUser) {
        newHireId = existingUser.id;
      } else {
        // Invite the new hire via Supabase auth
        const response = await fetch("/api/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.newHireEmail,
            fullName: formData.newHireName,
            role: "new_hire",
            startDate: formData.startDate,
          }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Failed to invite user");
        newHireId = result.userId;
      }

      // Calculate target end date (90 days)
      const startDate = new Date(formData.startDate);
      const targetEndDate = new Date(startDate);
      targetEndDate.setDate(targetEndDate.getDate() + 90);

      const selectedRole = roles.find((r) => r.id === formData.roleId);

      // Create the onboarding plan
      const { data: plan, error: planError } = await supabase
        .from("onboarding_plans")
        .insert({
          organization_id: currentUser.organization_id,
          template_id: formData.templateId || null,
          new_hire_id: newHireId,
          manager_id: formData.managerId,
          buddy_id: formData.buddyId || null,
          role_id: formData.roleId || null,
          title: `${formData.newHireName} - ${selectedRole?.title || "Onboarding"}`,
          status: formData.useAi ? "draft" : "active",
          start_date: formData.startDate,
          target_end_date: targetEndDate.toISOString().split("T")[0],
          notes: formData.notes || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (planError || !plan) throw new Error(planError?.message || "Failed to create plan");

      // Generate AI plan if requested
      if (formData.useAi) {
        setGenerating(true);
        const aiResponse = await fetch("/api/ai/generate-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: plan.id }),
        });

        if (!aiResponse.ok) {
          const aiResult = await aiResponse.json();
          console.error("AI generation failed:", aiResult.error);
          // Plan is still created, just not AI-generated
          await supabase
            .from("onboarding_plans")
            .update({ status: "active" })
            .eq("id", plan.id);
        }
      }

      router.push(`/onboardings/${plan.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Onboarding</h1>
        <p className="text-muted-foreground">Create a personalized onboarding plan for a new hire</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Onboarding Details</CardTitle>
          <CardDescription>Fill in the details to set up the onboarding journey</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}

            {generating && (
              <div className="flex items-center gap-3 rounded-md bg-primary/10 p-4">
                <Sparkles className="h-5 w-5 animate-pulse text-primary" />
                <div>
                  <p className="font-medium text-primary">Generating AI onboarding plan...</p>
                  <p className="text-sm text-muted-foreground">
                    Claude is creating a personalized 90-day plan based on the role and company docs
                  </p>
                </div>
              </div>
            )}

            {/* New Hire Info */}
            <div className="space-y-4">
              <h3 className="font-medium">New Hire</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newHireName">Full Name</Label>
                  <Input
                    id="newHireName"
                    placeholder="Jane Smith"
                    value={formData.newHireName}
                    onChange={(e) => setFormData({ ...formData, newHireName: e.target.value })}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newHireEmail">Email</Label>
                  <Input
                    id="newHireEmail"
                    type="email"
                    placeholder="jane@company.com"
                    value={formData.newHireEmail}
                    onChange={(e) => setFormData({ ...formData, newHireEmail: e.target.value })}
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Role & Template */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={formData.roleId}
                  onValueChange={(value) => setFormData({ ...formData, roleId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.title} ({role.department})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Template (optional)</Label>
                <Select
                  value={formData.templateId}
                  onValueChange={(value) => setFormData({ ...formData, templateId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((tmpl) => (
                      <SelectItem key={tmpl.id} value={tmpl.id}>
                        {tmpl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Manager & Buddy */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Manager</Label>
                <Select
                  value={formData.managerId}
                  onValueChange={(value) => setFormData({ ...formData, managerId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers
                      .filter((m) => ["owner", "admin", "manager"].includes(m.role))
                      .map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.full_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Buddy (optional)</Label>
                <Select
                  value={formData.buddyId}
                  onValueChange={(value) => setFormData({ ...formData, buddyId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select buddy" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any special requirements or context for this onboarding..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                disabled={loading}
              />
            </div>

            {/* AI Toggle */}
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <input
                type="checkbox"
                id="useAi"
                checked={formData.useAi}
                onChange={(e) => setFormData({ ...formData, useAi: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
                disabled={loading}
              />
              <div>
                <Label htmlFor="useAi" className="cursor-pointer">
                  Generate AI-powered 90-day plan
                </Label>
                <p className="text-sm text-muted-foreground">
                  Claude will create a personalized plan based on the role, company docs, and best practices
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading || generating} className="flex-1">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {generating ? "Generating Plan..." : "Create Onboarding"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
