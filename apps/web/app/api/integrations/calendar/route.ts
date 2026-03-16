import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createGoogleCalendarClient } from "@rampup/integrations";

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

    // Get Google Calendar integration
    const { data: integration } = await supabase
      .from("integration_connections")
      .select("access_token")
      .eq("organization_id", currentUser.organization_id)
      .eq("provider", "google_calendar")
      .eq("is_active", true)
      .single();

    if (!integration?.access_token) {
      return NextResponse.json({ error: "Google Calendar not connected" }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body;
    const calendar = createGoogleCalendarClient(integration.access_token);

    switch (action) {
      case "schedule_checkin": {
        const { newHireEmail, managerEmail, checkInDay, scheduledDate, scheduledTime, timezone } = body;
        const event = await calendar.scheduleCheckIn(
          newHireEmail, managerEmail, checkInDay, scheduledDate, scheduledTime, timezone
        );

        // Update check-in with calendar event ID
        if (body.checkInId) {
          await supabase
            .from("check_ins")
            .update({ calendar_event_id: event.id })
            .eq("id", body.checkInId);
        }

        return NextResponse.json({ event });
      }

      case "schedule_training": {
        const { attendeeEmails, title, description, date, startTime, durationMinutes, timezone } = body;
        const event = await calendar.scheduleTrainingSession(
          attendeeEmails, title, description, date, startTime, durationMinutes, timezone
        );
        return NextResponse.json({ event });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
