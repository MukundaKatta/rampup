import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createEmailClient } from "@rampup/integrations";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", authUser.id)
      .single();
    if (!currentUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Get SendGrid integration or fall back to env
    const { data: integration } = await supabase
      .from("integration_connections")
      .select("access_token, config")
      .eq("organization_id", currentUser.organization_id)
      .eq("provider", "sendgrid")
      .eq("is_active", true)
      .single();

    const apiKey = integration?.access_token || process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Email not configured" }, { status: 400 });
    }

    const fromEmail = (integration?.config as Record<string, string>)?.from_email || process.env.SENDGRID_FROM_EMAIL;
    const emailClient = createEmailClient(apiKey, fromEmail);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "welcome": {
        const { newHireEmail, newHireName, companyName, managerName, startDate } = body;
        const sent = await emailClient.sendWelcomeEmail(
          newHireEmail, newHireName, companyName, managerName, startDate, appUrl
        );
        return NextResponse.json({ sent });
      }

      case "checkin_reminder": {
        const { email, name, checkInDay, scheduledDate, withPerson } = body;
        const sent = await emailClient.sendCheckInReminder(
          email, name, checkInDay, scheduledDate, withPerson, appUrl
        );
        return NextResponse.json({ sent });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
