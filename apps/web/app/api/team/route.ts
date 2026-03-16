import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = await createAdminClient();

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", authUser.id)
      .single();

    if (!currentUser || !["owner", "admin", "manager"].includes(currentUser.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const { email, fullName, role = "member", department, jobTitle, startDate } = body;

    if (!email || !fullName) {
      return NextResponse.json({ error: "Email and full name are required" }, { status: 400 });
    }

    // Check if user already exists in this org
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .eq("organization_id", currentUser.organization_id)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: "User already exists in this organization", userId: existingUser.id }, { status: 409 });
    }

    // Invite user via Supabase Auth (admin API)
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        invited_by: authUser.id,
        organization_id: currentUser.organization_id,
      },
    });

    if (authError) {
      // User might already have an auth account from another org
      const { data: existingAuth } = await adminSupabase.auth.admin.listUsers();
      const existingAuthUser = existingAuth.users.find((u) => u.email === email);

      if (existingAuthUser) {
        // Create user profile for existing auth user
        const { error: profileError } = await supabase.from("users").insert({
          id: existingAuthUser.id,
          organization_id: currentUser.organization_id,
          email,
          full_name: fullName,
          role: role as "owner" | "admin" | "manager" | "member" | "new_hire",
          department: department || null,
          job_title: jobTitle || null,
          start_date: startDate || null,
        });

        if (profileError) {
          return NextResponse.json({ error: profileError.message }, { status: 500 });
        }

        return NextResponse.json({ userId: existingAuthUser.id, message: "User added to organization" });
      }

      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // Create user profile
    const { error: profileError } = await supabase.from("users").insert({
      id: authData.user.id,
      organization_id: currentUser.organization_id,
      email,
      full_name: fullName,
      role: role as "owner" | "admin" | "manager" | "member" | "new_hire",
      department: department || null,
      job_title: jobTitle || null,
      start_date: startDate || null,
    });

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ userId: authData.user.id, message: "User invited successfully" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
