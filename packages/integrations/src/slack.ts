interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: Array<{ type: string; text?: string }>;
  accessory?: Record<string, unknown>;
  fields?: Array<{ type: string; text: string }>;
}

interface SlackResponse {
  ok: boolean;
  error?: string;
  channel?: string;
  ts?: string;
}

export class SlackClient {
  private botToken: string;
  private baseUrl = "https://slack.com/api";

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  private async request(method: string, body: Record<string, unknown>): Promise<SlackResponse> {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!data.ok) {
      throw new Error(`Slack API error (${method}): ${data.error}`);
    }
    return data;
  }

  async sendDirectMessage(userId: string, text: string, blocks?: SlackBlock[]): Promise<string> {
    // Open DM channel
    const dmResponse = await this.request("conversations.open", { users: userId });
    const channelId = dmResponse.channel as unknown as { id: string };

    const result = await this.request("chat.postMessage", {
      channel: typeof channelId === "string" ? channelId : channelId.id,
      text,
      blocks,
    });

    return result.ts || "";
  }

  async sendTaskReminder(
    userId: string,
    tasks: Array<{
      title: string;
      description?: string;
      dueDate: string;
      resources?: Array<{ url: string; title: string }>;
    }>
  ): Promise<void> {
    const blocks: SlackBlock[] = [
      {
        type: "header",
        text: { type: "plain_text", text: "Your onboarding tasks for today", emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `You have *${tasks.length}* ${tasks.length === 1 ? "task" : "tasks"} to work on today:`,
        },
      },
    ];

    for (const task of tasks) {
      let taskText = `*${task.title}*`;
      if (task.description) {
        taskText += `\n${task.description}`;
      }
      if (task.resources && task.resources.length > 0) {
        taskText += `\n:link: ${task.resources.map((r) => `<${r.url}|${r.title}>`).join(" | ")}`;
      }

      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: taskText },
      });
    }

    blocks.push(
      { type: "divider" as const, text: undefined },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: ":bulb: Mark tasks as complete in RampUp when done!" }],
      }
    );

    await this.sendDirectMessage(
      userId,
      `You have ${tasks.length} onboarding tasks for today`,
      blocks
    );
  }

  async sendWelcomeMessage(
    userId: string,
    newHireName: string,
    managerName: string,
    startDate: string
  ): Promise<void> {
    const blocks: SlackBlock[] = [
      {
        type: "header",
        text: { type: "plain_text", text: `Welcome to the team, ${newHireName}! 🎉`, emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `We're excited to have you join us! Your onboarding journey starts on *${startDate}*.\n\n` +
            `Your manager *${managerName}* has set up a personalized onboarding plan for you. ` +
            `I'll be sending you daily task reminders and helpful resources to make your first 90 days smooth and productive.`,
        },
      },
      { type: "divider" as const, text: undefined },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: ":wave: *Here's what to expect:*\n" +
            "• Daily task reminders right here in Slack\n" +
            "• Links to important documents and resources\n" +
            "• Scheduled check-ins with your manager\n" +
            "• Progress updates and celebrations",
        },
      },
    ];

    await this.sendDirectMessage(userId, `Welcome to the team, ${newHireName}!`, blocks);
  }

  async sendCheckInReminder(
    userId: string,
    checkInDay: number,
    scheduledDate: string,
    withPerson: string
  ): Promise<void> {
    const blocks: SlackBlock[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:calendar: *Upcoming Check-in Reminder*\n\n` +
            `Your *Day ${checkInDay}* check-in with *${withPerson}* is scheduled for *${scheduledDate}*.\n\n` +
            `Take a moment to reflect on:\n` +
            `• What's gone well since your last check-in\n` +
            `• Any blockers or challenges you're facing\n` +
            `• Questions you'd like to discuss`,
        },
      },
    ];

    await this.sendDirectMessage(userId, `Day ${checkInDay} check-in reminder`, blocks);
  }

  async sendProgressUpdate(
    channelOrUserId: string,
    newHireName: string,
    completionPct: number,
    tasksCompleted: number,
    tasksTotal: number,
    highlights: string[]
  ): Promise<void> {
    const progressBar = generateProgressBar(completionPct);

    const blocks: SlackBlock[] = [
      {
        type: "header",
        text: { type: "plain_text", text: `Onboarding Progress: ${newHireName}`, emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Progress:*\n${progressBar} ${completionPct}%` },
          { type: "mrkdwn", text: `*Tasks:*\n${tasksCompleted}/${tasksTotal} completed` },
        ],
      },
    ];

    if (highlights.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Recent Highlights:*\n${highlights.map((h) => `• ${h}`).join("\n")}`,
        },
      });
    }

    await this.sendDirectMessage(channelOrUserId, `Onboarding progress for ${newHireName}`, blocks);
  }

  async sendMilestoneNotification(
    userId: string,
    milestoneName: string,
    message: string
  ): Promise<void> {
    const blocks: SlackBlock[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:trophy: *Milestone Reached: ${milestoneName}*\n\n${message}`,
        },
      },
    ];

    await this.sendDirectMessage(userId, `Milestone reached: ${milestoneName}`, blocks);
  }

  async lookupUserByEmail(email: string): Promise<string | null> {
    try {
      const response = await this.request("users.lookupByEmail", { email });
      const user = response as unknown as { user?: { id: string } };
      return user.user?.id || null;
    } catch {
      return null;
    }
  }
}

function generateProgressBar(percentage: number): string {
  const filled = Math.round(percentage / 10);
  const empty = 10 - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

export function createSlackClient(botToken?: string): SlackClient {
  const token = botToken || process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error("Slack bot token is required");
  }
  return new SlackClient(token);
}
