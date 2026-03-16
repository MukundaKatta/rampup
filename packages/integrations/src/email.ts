import sgMail from "@sendgrid/mail";

export interface EmailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailClient {
  private fromEmail: string;
  private fromName: string;

  constructor(apiKey: string, fromEmail?: string, fromName?: string) {
    sgMail.setApiKey(apiKey);
    this.fromEmail = fromEmail || process.env.SENDGRID_FROM_EMAIL || "onboarding@rampup.app";
    this.fromName = fromName || "RampUp";
  }

  async send(options: EmailOptions): Promise<boolean> {
    try {
      await sgMail.send({
        to: { email: options.to, name: options.toName },
        from: { email: this.fromEmail, name: this.fromName },
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      return true;
    } catch (error) {
      console.error("Failed to send email:", error);
      return false;
    }
  }

  async sendWelcomeEmail(
    newHireEmail: string,
    newHireName: string,
    companyName: string,
    managerName: string,
    startDate: string,
    appUrl: string
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #1a1a2e; font-size: 28px; margin-bottom: 8px;">Welcome to ${companyName}!</h1>
          <p style="color: #666; font-size: 16px;">Your onboarding journey starts ${startDate}</p>
        </div>

        <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <p style="font-size: 16px; line-height: 1.6;">Hi ${newHireName},</p>
          <p style="font-size: 16px; line-height: 1.6;">
            We're thrilled to have you join the team! Your manager <strong>${managerName}</strong>
            has prepared a personalized onboarding plan to help you get up to speed quickly.
          </p>
        </div>

        <div style="margin-bottom: 24px;">
          <h2 style="color: #1a1a2e; font-size: 20px;">What to Expect</h2>
          <div style="display: flex; margin-bottom: 16px;">
            <div style="background: #e8f4fd; border-radius: 8px; padding: 16px; flex: 1; margin-right: 8px;">
              <strong>Week 1-2</strong><br>
              <span style="color: #666; font-size: 14px;">Setup, meet the team, and review key docs</span>
            </div>
          </div>
          <div style="display: flex; margin-bottom: 16px;">
            <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; flex: 1; margin-right: 8px;">
              <strong>Week 3-4</strong><br>
              <span style="color: #666; font-size: 14px;">Shadow sessions and your first small tasks</span>
            </div>
          </div>
          <div style="display: flex; margin-bottom: 16px;">
            <div style="background: #fef3c7; border-radius: 8px; padding: 16px; flex: 1; margin-right: 8px;">
              <strong>Month 2</strong><br>
              <span style="color: #666; font-size: 14px;">Independent work and your first project</span>
            </div>
          </div>
          <div style="display: flex; margin-bottom: 16px;">
            <div style="background: #fce4ec; border-radius: 8px; padding: 16px; flex: 1; margin-right: 8px;">
              <strong>Month 3</strong><br>
              <span style="color: #666; font-size: 14px;">Full ownership and your first review</span>
            </div>
          </div>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${appUrl}" style="display: inline-block; background: #1a1a2e; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
            View Your Onboarding Plan
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          Sent by RampUp - AI-powered employee onboarding<br>
          <a href="${appUrl}" style="color: #999;">rampup.app</a>
        </p>
      </body>
      </html>
    `;

    return this.send({
      to: newHireEmail,
      toName: newHireName,
      subject: `Welcome to ${companyName}! Your onboarding plan is ready`,
      html,
    });
  }

  async sendWeeklyDigest(
    managerEmail: string,
    managerName: string,
    digests: Array<{
      newHireName: string;
      completionPct: number;
      tasksCompletedThisWeek: number;
      tasksDueNextWeek: number;
      overdueCount: number;
      onTrack: boolean;
      planUrl: string;
    }>,
    appUrl: string
  ): Promise<boolean> {
    const planRows = digests
      .map(
        (d) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">
            <strong>${d.newHireName}</strong>
            ${d.onTrack ? '<span style="color: #22c55e;">&#x2713;</span>' : '<span style="color: #ef4444;">&#x26a0;</span>'}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
            <div style="background: #e5e7eb; border-radius: 4px; overflow: hidden; height: 8px;">
              <div style="background: ${d.onTrack ? "#22c55e" : "#ef4444"}; height: 100%; width: ${d.completionPct}%;"></div>
            </div>
            <span style="font-size: 12px; color: #666;">${d.completionPct}%</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${d.tasksCompletedThisWeek}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${d.tasksDueNextWeek}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
            ${d.overdueCount > 0 ? `<span style="color: #ef4444; font-weight: bold;">${d.overdueCount}</span>` : "0"}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
            <a href="${d.planUrl}" style="color: #1a1a2e;">View</a>
          </td>
        </tr>`
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; color: #333;">
        <h2 style="color: #1a1a2e;">Weekly Onboarding Digest</h2>
        <p>Hi ${managerName}, here's your team's onboarding progress this week:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
          <thead>
            <tr style="background: #f8f9fa;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">New Hire</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #dee2e6;">Progress</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #dee2e6;">Done</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #dee2e6;">Next Week</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #dee2e6;">Overdue</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #dee2e6;">Plan</th>
            </tr>
          </thead>
          <tbody>${planRows}</tbody>
        </table>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${appUrl}/analytics" style="display: inline-block; background: #1a1a2e; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px;">
            View Full Analytics
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">Sent by RampUp - AI-powered employee onboarding</p>
      </body>
      </html>
    `;

    return this.send({
      to: managerEmail,
      toName: managerName,
      subject: `Weekly Onboarding Digest - ${digests.length} active onboarding${digests.length !== 1 ? "s" : ""}`,
      html,
    });
  }

  async sendCheckInReminder(
    email: string,
    name: string,
    checkInDay: number,
    scheduledDate: string,
    withPerson: string,
    appUrl: string
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h2 style="color: #1a1a2e;">Check-in Reminder</h2>
        <p>Hi ${name},</p>
        <p>Your <strong>Day ${checkInDay}</strong> onboarding check-in with <strong>${withPerson}</strong> is scheduled for <strong>${scheduledDate}</strong>.</p>

        <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Before the check-in, reflect on:</strong></p>
          <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
            <li>What has gone well since you started?</li>
            <li>Are there any blockers or challenges?</li>
            <li>Questions you'd like to discuss?</li>
            <li>What support would be most helpful?</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${appUrl}" style="display: inline-block; background: #1a1a2e; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px;">
            View Your Progress
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">Sent by RampUp</p>
      </body>
      </html>
    `;

    return this.send({
      to: email,
      toName: name,
      subject: `Day ${checkInDay} Check-in Reminder with ${withPerson}`,
      html,
    });
  }
}

export function createEmailClient(
  apiKey?: string,
  fromEmail?: string,
  fromName?: string
): EmailClient {
  const key = apiKey || process.env.SENDGRID_API_KEY;
  if (!key) {
    throw new Error("SendGrid API key is required");
  }
  return new EmailClient(key, fromEmail, fromName);
}
