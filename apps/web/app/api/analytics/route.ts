import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: currentUser } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", authUser.id)
      .single();
    if (!currentUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const orgId = currentUser.organization_id;
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "30"; // days

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));
    const startDateStr = startDate.toISOString().split("T")[0];

    // Get metrics in time range
    const { data: metrics } = await supabase
      .from("ramp_metrics")
      .select("*")
      .eq("organization_id", orgId)
      .gte("recorded_date", startDateStr)
      .order("recorded_date", { ascending: true });

    // Get plan summaries
    const { data: plans } = await supabase
      .from("onboarding_plans")
      .select("id, status, completion_percentage, start_date, target_end_date, actual_end_date, role:roles(department)")
      .eq("organization_id", orgId);

    // Calculate aggregate stats
    const activePlans = (plans || []).filter((p) => p.status === "active");
    const completedPlans = (plans || []).filter((p) => p.status === "completed");

    const avgCompletion = activePlans.length > 0
      ? Math.round(activePlans.reduce((sum, p) => sum + p.completion_percentage, 0) / activePlans.length)
      : 0;

    const avgDaysToComplete = completedPlans.length > 0
      ? Math.round(
          completedPlans.reduce((sum, p) => {
            if (p.actual_end_date) {
              const days = (new Date(p.actual_end_date).getTime() - new Date(p.start_date).getTime()) / (1000 * 60 * 60 * 24);
              return sum + days;
            }
            return sum;
          }, 0) / completedPlans.length
        )
      : 0;

    return NextResponse.json({
      metrics: metrics || [],
      summary: {
        totalPlans: (plans || []).length,
        activePlans: activePlans.length,
        completedPlans: completedPlans.length,
        avgCompletion,
        avgDaysToComplete,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
