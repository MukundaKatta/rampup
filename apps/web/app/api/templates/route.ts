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

    const { data: templates, error } = await supabase
      .from("onboarding_templates")
      .select(`
        *,
        role:roles(title, department),
        template_tasks(id)
      `)
      .eq("organization_id", currentUser.organization_id)
      .order("name");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ templates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
