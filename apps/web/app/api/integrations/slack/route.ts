import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", authUser.id)
      .single();

    if (!currentUser || !["owner", "admin"].includes(currentUser.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { provider, config, orgId } = await request.json();

    if (orgId !== currentUser.organization_id) {
      return NextResponse.json({ error: "Organization mismatch" }, { status: 403 });
    }

    // Map config fields to integration connection
    let accessToken: string | null = null;
    const integrationConfig: Record<string, string> = {};

    switch (provider) {
      case "slack":
        accessToken = config.bot_token || null;
        break;
      case "google_calendar":
      case "google_drive":
        integrationConfig.client_id = config.client_id || "";
        integrationConfig.client_secret = config.client_secret || "";
        if (config.folder_id) integrationConfig.folder_id = config.folder_id;
        break;
      case "sendgrid":
        accessToken = config.api_key || null;
        integrationConfig.from_email = config.from_email || "";
        break;
      default:
        return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const { error } = await supabase
      .from("integration_connections")
      .upsert(
        {
          organization_id: orgId,
          provider,
          is_active: true,
          access_token: accessToken,
          config: integrationConfig,
          connected_by: authUser.id,
        },
        { onConflict: "organization_id,provider" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", authUser.id)
      .single();

    if (!currentUser || !["owner", "admin"].includes(currentUser.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const provider = request.nextUrl.searchParams.get("provider");
    const orgId = request.nextUrl.searchParams.get("orgId");

    if (!provider || orgId !== currentUser.organization_id) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { error } = await supabase
      .from("integration_connections")
      .update({ is_active: false, access_token: null, refresh_token: null })
      .eq("organization_id", orgId)
      .eq("provider", provider);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
