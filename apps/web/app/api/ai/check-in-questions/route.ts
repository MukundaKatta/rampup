import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCheckInQuestions } from "@rampup/ai-engine";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId, checkInId, checkInDay } = await request.json();

    // Fetch plan context
    const { data: plan } = await supabase
      .from("onboarding_plans")
      .select(`
        *,
        new_hire:users!onboarding_plans_new_hire_id_fkey(full_name, department),
        role:roles(title, department)
      `)
      .eq("id", planId)
      .single();

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const newHire = plan.new_hire as unknown as { full_name: string; department: string | null };
    const role = plan.role as unknown as { title: string; department: string } | null;

    // Get task stats
    const { data: tasks } = await supabase
      .from("plan_tasks")
      .select("id, title, status, due_date")
      .eq("plan_id", planId);

    const completedTasks = (tasks || []).filter((t) => t.status === "completed");
    const overdueTasks = (tasks || []).filter((t) => t.status === "overdue");
    const upcomingTasks = (tasks || [])
      .filter((t) => t.status === "pending" || t.status === "in_progress")
      .slice(0, 5);

    // Get previous check-in data
    const { data: previousCheckIn } = await supabase
      .from("check_ins")
      .select("notes, blockers, mood_rating")
      .eq("plan_id", planId)
      .eq("status", "completed")
      .order("check_in_day", { ascending: false })
      .limit(1)
      .single();

    const questions = await generateCheckInQuestions({
      newHireName: newHire.full_name,
      roleName: role?.title || "General",
      department: role?.department || newHire.department || "Unknown",
      checkInDay,
      completionPercentage: plan.completion_percentage,
      tasksCompleted: completedTasks.length,
      tasksTotal: (tasks || []).length,
      overdueTaskCount: overdueTasks.length,
      recentCompletedTasks: completedTasks.slice(-5).map((t) => t.title),
      upcomingTasks: upcomingTasks.map((t) => t.title),
      previousCheckInNotes: previousCheckIn?.notes || undefined,
      previousBlockers: previousCheckIn?.blockers || undefined,
      previousMoodRating: previousCheckIn?.mood_rating || undefined,
    });

    // Save AI questions to the check-in
    if (checkInId) {
      const allQuestions = [
        ...questions.openingQuestions,
        ...questions.progressQuestions,
        ...questions.wellbeingQuestions,
        ...questions.forwardLookingQuestions,
      ];

      await supabase
        .from("check_ins")
        .update({ ai_suggested_questions: allQuestions })
        .eq("id", checkInId);
    }

    return NextResponse.json({
      questions: [
        ...questions.openingQuestions,
        ...questions.progressQuestions,
        ...questions.wellbeingQuestions,
        ...questions.forwardLookingQuestions,
      ],
      suggestedTopics: questions.suggestedTopics,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
