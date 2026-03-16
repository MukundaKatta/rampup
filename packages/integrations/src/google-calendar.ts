import { google, calendar_v3 } from "googleapis";

export interface CalendarEventInput {
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  attendeeEmails: string[];
  timezone?: string;
  location?: string;
  conferenceData?: boolean;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  htmlLink: string;
  startDateTime: string;
  endDateTime: string;
  meetLink?: string;
}

export class GoogleCalendarClient {
  private calendar: calendar_v3.Calendar;

  constructor(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    this.calendar = google.calendar({ version: "v3", auth });
  }

  async createEvent(input: CalendarEventInput): Promise<CalendarEvent> {
    const event: calendar_v3.Schema$Event = {
      summary: input.summary,
      description: input.description,
      start: {
        dateTime: input.startDateTime,
        timeZone: input.timezone || "America/New_York",
      },
      end: {
        dateTime: input.endDateTime,
        timeZone: input.timezone || "America/New_York",
      },
      attendees: input.attendeeEmails.map((email) => ({ email })),
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 60 },
          { method: "popup", minutes: 15 },
        ],
      },
    };

    if (input.location) {
      event.location = input.location;
    }

    if (input.conferenceData) {
      event.conferenceData = {
        createRequest: {
          requestId: `rampup-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      };
    }

    const response = await this.calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
      conferenceDataVersion: input.conferenceData ? 1 : 0,
      sendUpdates: "all",
    });

    const data = response.data;
    return {
      id: data.id!,
      summary: data.summary!,
      htmlLink: data.htmlLink!,
      startDateTime: data.start?.dateTime || data.start?.date || "",
      endDateTime: data.end?.dateTime || data.end?.date || "",
      meetLink: data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri || undefined,
    };
  }

  async scheduleCheckIn(
    newHireEmail: string,
    managerEmail: string,
    checkInDay: number,
    scheduledDate: string,
    scheduledTime: string = "10:00",
    timezone: string = "America/New_York"
  ): Promise<CalendarEvent> {
    const startDateTime = `${scheduledDate}T${scheduledTime}:00`;
    const endHour = parseInt(scheduledTime.split(":")[0]) + 1;
    const endTime = `${endHour.toString().padStart(2, "0")}:${scheduledTime.split(":")[1]}`;
    const endDateTime = `${scheduledDate}T${endTime}:00`;

    return this.createEvent({
      summary: `Day ${checkInDay} Onboarding Check-in`,
      description:
        `Onboarding check-in meeting (Day ${checkInDay}).\n\n` +
        `This is a regular check-in to discuss onboarding progress, ` +
        `address any questions or concerns, and ensure a smooth ramp-up.\n\n` +
        `Powered by RampUp`,
      startDateTime,
      endDateTime,
      attendeeEmails: [newHireEmail, managerEmail],
      timezone,
      conferenceData: true,
    });
  }

  async scheduleTrainingSession(
    attendeeEmails: string[],
    title: string,
    description: string,
    date: string,
    startTime: string,
    durationMinutes: number,
    timezone: string = "America/New_York"
  ): Promise<CalendarEvent> {
    const startDateTime = `${date}T${startTime}:00`;

    const startDate = new Date(`${date}T${startTime}:00`);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
    const endDateTime = endDate.toISOString().replace("Z", "").split(".")[0];

    return this.createEvent({
      summary: `[Onboarding] ${title}`,
      description: `${description}\n\nPowered by RampUp`,
      startDateTime,
      endDateTime,
      attendeeEmails,
      timezone,
      conferenceData: true,
    });
  }

  async updateEvent(eventId: string, updates: Partial<CalendarEventInput>): Promise<CalendarEvent> {
    const event: calendar_v3.Schema$Event = {};

    if (updates.summary) event.summary = updates.summary;
    if (updates.description) event.description = updates.description;
    if (updates.startDateTime) {
      event.start = {
        dateTime: updates.startDateTime,
        timeZone: updates.timezone || "America/New_York",
      };
    }
    if (updates.endDateTime) {
      event.end = {
        dateTime: updates.endDateTime,
        timeZone: updates.timezone || "America/New_York",
      };
    }

    const response = await this.calendar.events.patch({
      calendarId: "primary",
      eventId,
      requestBody: event,
      sendUpdates: "all",
    });

    const data = response.data;
    return {
      id: data.id!,
      summary: data.summary!,
      htmlLink: data.htmlLink!,
      startDateTime: data.start?.dateTime || data.start?.date || "",
      endDateTime: data.end?.dateTime || data.end?.date || "",
      meetLink: data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri || undefined,
    };
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.calendar.events.delete({
      calendarId: "primary",
      eventId,
      sendUpdates: "all",
    });
  }

  async getFreeBusy(
    emails: string[],
    timeMin: string,
    timeMax: string,
    timezone: string = "America/New_York"
  ): Promise<Map<string, Array<{ start: string; end: string }>>> {
    const response = await this.calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: timezone,
        items: emails.map((email) => ({ id: email })),
      },
    });

    const busyMap = new Map<string, Array<{ start: string; end: string }>>();
    const calendars = response.data.calendars || {};

    for (const email of emails) {
      const busy = calendars[email]?.busy || [];
      busyMap.set(
        email,
        busy.map((b) => ({
          start: b.start || "",
          end: b.end || "",
        }))
      );
    }

    return busyMap;
  }
}

export function createGoogleCalendarClient(accessToken: string): GoogleCalendarClient {
  return new GoogleCalendarClient(accessToken);
}
