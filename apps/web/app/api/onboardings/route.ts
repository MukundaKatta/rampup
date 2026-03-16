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

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");

    let query = supabase
      .from("onboarding_plans")
      .select(`
        *,
        new_hire:users!onboarding_plans_new_hire_id_fkey(full_name, avatar_url, job_title, department),
        manager:users!onboarding_plans_manager_id_fkey(full_name),
        role:roles(title, department)
      `)
      .eq("organization_id", currentUser.organization_id)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data: plans, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ plans });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "Plan ID required" }, { status: 400 });

    const { data, error } = await supabase
      .from("onboarding_plans")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ plan: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
