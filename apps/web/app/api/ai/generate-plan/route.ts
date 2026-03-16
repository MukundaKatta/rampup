import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateOnboardingPlan } from "@rampup/ai-engine";
import type { RoleContext, NewHireContext, DocumentContext } from "@rampup/ai-engine";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId } = await request.json();
    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    // Fetch plan with all context
    const { data: plan, error: planError } = await supabase
      .from("onboarding_plans")
      .select(`
        *,
        new_hire:users!onboarding_plans_new_hire_id_fkey(full_name, job_title, department, start_date),
        manager:users!onboarding_plans_manager_id_fkey(full_name, job_title),
        buddy:users!onboarding_plans_buddy_id_fkey(full_name),
        role:roles(*),
        template:onboarding_templates(*, template_tasks(*))
      `)
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const newHire = plan.new_hire as unknown as {
      full_name: string; job_title: string | null; department: string | null; start_date: string | null;
    };
    const manager = plan.manager as unknown as { full_name: string; job_title: string | null };
    const buddy = plan.buddy as unknown as { full_name: string } | null;
    const role = plan.role as unknown as {
      title: string; department: string; level: string | null; description: string | null;
      required_skills: string[]; tools_and_access: string[]; key_stakeholders: string[];
    } | null;

    // Fetch relevant documents
    const { data: documents } = await supabase
      .from("documents")
      .select("title, document_type, content_text")
      .eq("organization_id", plan.organization_id)
      .not("content_text", "is", null)
      .limit(15);

    const roleContext: RoleContext = {
      title: role?.title || newHire.job_title || "General",
      department: role?.department || newHire.department || "General",
      level: role?.level || undefined,
      requiredSkills: role?.required_skills || [],
      toolsAndAccess: role?.tools_and_access || [],
      keyStakeholders: role?.key_stakeholders || [],
      description: role?.description || undefined,
    };

    const newHireContext: NewHireContext = {
      fullName: newHire.full_name,
      startDate: plan.start_date,
      managerName: manager.full_name,
      managerTitle: manager.job_title || "Manager",
      buddyName: buddy?.full_name,
    };

    const docContexts: DocumentContext[] = (documents || []).map((d) => ({
      title: d.title,
      type: d.document_type,
      summary: (d.content_text || "").substring(0, 500),
    }));

    // Get existing template tasks
    const templateData = plan.template as unknown as { template_tasks?: Array<{ title: string; description: string; task_type: string; day_offset: number }> } | null;
    const existingTemplateTasks = (templateData?.template_tasks || []).map((t) => ({
      title: t.title,
      description: t.description,
      taskType: t.task_type,
      dayOffset: t.day_offset,
    }));

    // Generate plan with AI
    const generatedPlan = await generateOnboardingPlan(
      roleContext,
      newHireContext,
      docContexts,
      existingTemplateTasks,
      90
    );

    // Update plan phases
    await supabase
      .from("onboarding_plans")
      .update({
        phases: generatedPlan.phases,
        ai_generated: true,
        ai_generation_context: {
          model: "claude-sonnet-4-20250514",
          generated_at: new Date().toISOString(),
          documents_used: docContexts.map((d) => d.title),
        },
        status: "active",
      })
      .eq("id", planId);

    // Create plan tasks
    const startDate = new Date(plan.start_date);
    const planTasks = generatedPlan.tasks.map((task, index) => {
      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + task.dayOffset - 1);

      return {
        plan_id: planId,
        title: task.title,
        description: task.description,
        task_type: task.taskType,
        status: "pending" as const,
        assigned_to: task.assigneeRole === "new_hire" ? plan.new_hire_id : plan.manager_id,
        due_date: dueDate.toISOString().split("T")[0],
        is_required: task.isRequired,
        is_ai_generated: true,
        resources: task.resources,
        duration_minutes: task.durationMinutes,
        sort_order: index,
        phase_name: task.phaseName,
      };
    });

    const { error: insertError } = await supabase.from("plan_tasks").insert(planTasks);
    if (insertError) {
      return NextResponse.json({ error: `Failed to insert tasks: ${insertError.message}` }, { status: 500 });
    }

    // Schedule check-ins
    const checkInDays = [7, 14, 30, 60, 90];
    const checkIns = checkInDays.map((day) => {
      const scheduledDate = new Date(startDate);
      scheduledDate.setDate(scheduledDate.getDate() + day - 1);
      return {
        plan_id: planId,
        new_hire_id: plan.new_hire_id,
        interviewer_id: plan.manager_id,
        scheduled_date: scheduledDate.toISOString().split("T")[0],
        scheduled_time: "10:00",
        check_in_day: day,
        status: "scheduled" as const,
      };
    });

    await supabase.from("check_ins").insert(checkIns);

    return NextResponse.json({
      success: true,
      tasksCreated: planTasks.length,
      checkInsScheduled: checkIns.length,
      phases: generatedPlan.phases,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
