import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeProgress } from "@rampup/ai-engine";
import { calculateDayNumber } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId } = await request.json();

    const { data: plan } = await supabase
      .from("onboarding_plans")
      .select(`
        *,
        new_hire:users!onboarding_plans_new_hire_id_fkey(full_name),
        role:roles(title)
      `)
      .eq("id", planId)
      .single();

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const newHire = plan.new_hire as unknown as { full_name: string };
    const role = plan.role as unknown as { title: string } | null;

    // Get task data
    const { data: tasks } = await supabase
      .from("plan_tasks")
      .select("id, title, status")
      .eq("plan_id", planId);

    // Get task completions with feedback
    const { data: completions } = await supabase
      .from("task_completions")
      .select("rating, feedback, time_spent_minutes")
      .eq("plan_id", planId);

    // Get check-in data
    const { data: checkIns } = await supabase
      .from("check_ins")
      .select("mood_rating, confidence_rating, blockers")
      .eq("plan_id", planId)
      .eq("status", "completed");

    // Get metrics history
    const { data: metrics } = await supabase
      .from("ramp_metrics")
      .select("day_number, completion_percentage, on_track")
      .eq("plan_id", planId)
      .order("recorded_date", { ascending: true });

    const dayNumber = calculateDayNumber(plan.start_date);
    const totalDays = Math.ceil(
      (new Date(plan.target_end_date).getTime() - new Date(plan.start_date).getTime()) / (1000 * 60 * 60 * 24)
    );

    const ratings = (completions || []).filter((c) => c.rating !== null).map((c) => c.rating!);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

    const timesSpent = (completions || []).filter((c) => c.time_spent_minutes !== null).map((c) => c.time_spent_minutes!);
    const avgTimeSpent = timesSpent.length > 0 ? timesSpent.reduce((a, b) => a + b, 0) / timesSpent.length : null;

    const analysis = await analyzeProgress({
      newHireName: newHire.full_name,
      roleName: role?.title || "General",
      dayNumber,
      totalDays,
      completionPercentage: plan.completion_percentage,
      tasksCompleted: (tasks || []).filter((t) => t.status === "completed").length,
      tasksTotal: (tasks || []).length,
      overdueCount: (tasks || []).filter((t) => t.status === "overdue").length,
      averageTaskRating: avgRating,
      averageTimeSpentMinutes: avgTimeSpent,
      checkInMoodRatings: (checkIns || []).filter((c) => c.mood_rating).map((c) => c.mood_rating!),
      checkInConfidenceRatings: (checkIns || []).filter((c) => c.confidence_rating).map((c) => c.confidence_rating!),
      blockers: (checkIns || []).flatMap((c) => c.blockers || []),
      recentFeedback: (completions || []).filter((c) => c.feedback).map((c) => c.feedback!).slice(-5),
      metricsHistory: (metrics || []).map((m) => ({
        dayNumber: m.day_number,
        completionPercentage: m.completion_percentage,
        onTrack: m.on_track,
      })),
    });

    return NextResponse.json({ analysis });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
