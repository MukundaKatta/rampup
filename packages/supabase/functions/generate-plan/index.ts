import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.32.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeneratePlanRequest {
  plan_id: string;
  organization_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

    const { plan_id, organization_id }: GeneratePlanRequest = await req.json();

    // Fetch the plan with all context
    const { data: plan, error: planError } = await supabase
      .from("onboarding_plans")
      .select(`
        *,
        new_hire:users!onboarding_plans_new_hire_id_fkey(*),
        manager:users!onboarding_plans_manager_id_fkey(full_name, job_title, department),
        role:roles(*),
        template:onboarding_templates(*, template_tasks(*))
      `)
      .eq("id", plan_id)
      .single();

    if (planError || !plan) {
      throw new Error(`Plan not found: ${planError?.message}`);
    }

    // Fetch relevant company documents
    const { data: documents } = await supabase
      .from("documents")
      .select("title, description, document_type, content_text, tags")
      .eq("organization_id", organization_id)
      .or(`applicable_roles.cs.{${plan.role_id}},is_required_reading.eq.true`)
      .not("content_text", "is", null)
      .limit(20);

    // Fetch existing template tasks if template exists
    const templateTasks = plan.template?.template_tasks || [];

    // Build context for Claude
    const newHire = plan.new_hire as Record<string, unknown>;
    const role = plan.role as Record<string, unknown>;
    const manager = plan.manager as Record<string, unknown>;

    const docSummaries = (documents || [])
      .map((d) => `- ${d.title} (${d.document_type}): ${d.content_text?.substring(0, 500)}`)
      .join("\n");

    const templateTaskList = templateTasks
      .map((t: Record<string, unknown>) => `- Day ${t.day_offset}: [${t.task_type}] ${t.title} - ${t.description || ""}`)
      .join("\n");

    const prompt = `You are an expert onboarding specialist. Generate a comprehensive 90-day onboarding plan for a new hire.

NEW HIRE DETAILS:
- Name: ${newHire.full_name}
- Role: ${role?.title || newHire.job_title || "Unknown"}
- Department: ${role?.department || newHire.department || "Unknown"}
- Level: ${(role as Record<string, unknown>)?.level || "Not specified"}
- Required Skills: ${((role as Record<string, unknown>)?.required_skills as string[])?.join(", ") || "Not specified"}
- Tools & Access Needed: ${((role as Record<string, unknown>)?.tools_and_access as string[])?.join(", ") || "Not specified"}
- Key Stakeholders: ${((role as Record<string, unknown>)?.key_stakeholders as string[])?.join(", ") || "Not specified"}
- Manager: ${(manager as Record<string, unknown>)?.full_name} (${(manager as Record<string, unknown>)?.job_title})
- Start Date: ${plan.start_date}

${templateTaskList ? `EXISTING TEMPLATE TASKS (enhance and supplement these):\n${templateTaskList}\n` : ""}

COMPANY DOCUMENTS AVAILABLE:
${docSummaries || "No documents uploaded yet."}

Generate a detailed onboarding plan with tasks organized into 4 phases:
1. Orientation (Days 1-14): Setup, team introductions, core documentation review
2. Learning (Days 15-30): Shadow sessions, training, first small tasks
3. Contributing (Days 31-60): Independent work, first project, deeper team integration
4. Ownership (Days 61-90): Full ownership, performance review preparation

For each task, provide:
- title: Clear, actionable task name
- description: Detailed description of what to do
- task_type: One of: reading, meeting, setup, training, project, social, review, custom
- day_offset: Day number (1-90)
- duration_minutes: Estimated time
- is_required: true/false
- assignee_role: new_hire, manager, buddy, or it
- phase_name: Orientation, Learning, Contributing, or Ownership
- resources: Array of {url, title, type} if relevant

Return ONLY a valid JSON object with this structure:
{
  "phases": [
    {"name": "Orientation", "start_day": 1, "end_day": 14, "description": "..."},
    {"name": "Learning", "start_day": 15, "end_day": 30, "description": "..."},
    {"name": "Contributing", "start_day": 31, "end_day": 60, "description": "..."},
    {"name": "Ownership", "start_day": 61, "end_day": 90, "description": "..."}
  ],
  "tasks": [
    {
      "title": "...",
      "description": "...",
      "task_type": "...",
      "day_offset": 1,
      "duration_minutes": 30,
      "is_required": true,
      "assignee_role": "new_hire",
      "phase_name": "Orientation",
      "resources": []
    }
  ]
}

Generate 40-60 tasks covering all aspects of onboarding. Be specific and actionable.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";

    // Parse the JSON from Claude's response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response as JSON");
    }

    const generatedPlan = JSON.parse(jsonMatch[0]);

    // Update plan phases
    await supabase
      .from("onboarding_plans")
      .update({
        phases: generatedPlan.phases,
        ai_generated: true,
        ai_generation_context: {
          model: "claude-sonnet-4-20250514",
          generated_at: new Date().toISOString(),
          documents_used: (documents || []).map((d) => d.title),
          template_tasks_count: templateTasks.length,
        },
        status: "active",
      })
      .eq("id", plan_id);

    // Create plan tasks
    const startDate = new Date(plan.start_date);
    const planTasks = generatedPlan.tasks.map((task: Record<string, unknown>, index: number) => {
      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + (task.day_offset as number) - 1);

      return {
        plan_id,
        title: task.title,
        description: task.description,
        task_type: task.task_type,
        status: "pending",
        assigned_to: task.assignee_role === "new_hire" ? plan.new_hire_id : plan.manager_id,
        due_date: dueDate.toISOString().split("T")[0],
        is_required: task.is_required,
        is_ai_generated: true,
        resources: task.resources || [],
        duration_minutes: task.duration_minutes,
        sort_order: index,
        phase_name: task.phase_name,
      };
    });

    const { error: insertError } = await supabase.from("plan_tasks").insert(planTasks);

    if (insertError) {
      throw new Error(`Failed to insert tasks: ${insertError.message}`);
    }

    // Schedule check-ins at Day 7, 14, 30, 60, 90
    const checkInDays = [7, 14, 30, 60, 90];
    const checkIns = checkInDays.map((day) => {
      const scheduledDate = new Date(startDate);
      scheduledDate.setDate(scheduledDate.getDate() + day - 1);

      return {
        plan_id,
        new_hire_id: plan.new_hire_id,
        interviewer_id: plan.manager_id,
        scheduled_date: scheduledDate.toISOString().split("T")[0],
        scheduled_time: "10:00",
        check_in_day: day,
        status: "scheduled" as const,
      };
    });

    await supabase.from("check_ins").insert(checkIns);

    return new Response(
      JSON.stringify({
        message: "Plan generated successfully",
        plan_id,
        tasks_created: planTasks.length,
        checkins_scheduled: checkIns.length,
        phases: generatedPlan.phases,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
