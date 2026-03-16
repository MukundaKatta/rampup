import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskForNudge {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  due_date: string;
  phase_name: string | null;
  resources: Array<{ url: string; title: string }>;
  plan: {
    title: string;
    new_hire: {
      full_name: string;
      email: string;
      slack_user_id: string | null;
    };
    manager: {
      full_name: string;
      slack_user_id: string | null;
    };
    organization: {
      name: string;
      settings: {
        daily_nudge_time: string;
        timezone: string;
      };
    };
  };
}

async function sendSlackMessage(
  botToken: string,
  channel: string,
  blocks: Record<string, unknown>[],
  text: string
): Promise<boolean> {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, blocks, text }),
  });

  const data = await response.json();
  return data.ok === true;
}

async function sendEmailNudge(
  apiKey: string,
  toEmail: string,
  toName: string,
  tasks: TaskForNudge[],
  fromEmail: string
): Promise<boolean> {
  const taskListHtml = tasks
    .map(
      (t) => `
      <li style="margin-bottom: 12px;">
        <strong>${t.title}</strong>
        ${t.description ? `<br><span style="color: #666;">${t.description}</span>` : ""}
        ${t.resources.length > 0 ? `<br>Resources: ${t.resources.map((r) => `<a href="${r.url}">${r.title}</a>`).join(", ")}` : ""}
      </li>`
    )
    .join("");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Good morning, ${toName}! 🌅</h2>
      <p>Here are your onboarding tasks for today:</p>
      <ul style="list-style: none; padding: 0;">${taskListHtml}</ul>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #999; font-size: 12px;">Sent by RampUp - Your onboarding autopilot</p>
    </div>
  `;

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: toEmail, name: toName }] }],
      from: { email: fromEmail, name: "RampUp" },
      subject: `Your onboarding tasks for today (${tasks.length} ${tasks.length === 1 ? "task" : "tasks"})`,
      content: [{ type: "text/html", value: html }],
    }),
  });

  return response.status === 202;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().split("T")[0];

    // Get all tasks due today for active onboarding plans
    const { data: todayTasks, error: tasksError } = await supabase
      .from("plan_tasks")
      .select(`
        id, title, description, task_type, due_date, phase_name, resources,
        plan:onboarding_plans!inner(
          title, status,
          new_hire:users!onboarding_plans_new_hire_id_fkey(full_name, email, slack_user_id),
          manager:users!onboarding_plans_manager_id_fkey(full_name, slack_user_id),
          organization:organizations!inner(name, settings)
        )
      `)
      .eq("due_date", today)
      .in("status", ["pending", "in_progress"])
      .eq("plan.status", "active");

    if (tasksError) {
      throw new Error(`Failed to fetch tasks: ${tasksError.message}`);
    }

    if (!todayTasks || todayTasks.length === 0) {
      return new Response(JSON.stringify({ message: "No tasks due today", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group tasks by new hire
    const tasksByHire = new Map<string, TaskForNudge[]>();
    for (const task of todayTasks as unknown as TaskForNudge[]) {
      const hireEmail = task.plan.new_hire.email;
      if (!tasksByHire.has(hireEmail)) {
        tasksByHire.set(hireEmail, []);
      }
      tasksByHire.get(hireEmail)!.push(task);
    }

    let slackSent = 0;
    let emailSent = 0;

    // Get integration tokens
    const orgIds = new Set(
      (todayTasks as unknown as TaskForNudge[]).map(
        (t) => (t as unknown as { plan: { organization_id: string } }).plan.organization_id
      )
    );

    const { data: integrations } = await supabase
      .from("integration_connections")
      .select("organization_id, provider, access_token, is_active")
      .in("organization_id", Array.from(orgIds))
      .eq("is_active", true);

    const slackTokens = new Map<string, string>();
    const sendgridKeys = new Map<string, string>();

    for (const integration of integrations || []) {
      if (integration.provider === "slack" && integration.access_token) {
        slackTokens.set(integration.organization_id, integration.access_token);
      }
      if (integration.provider === "sendgrid" && integration.access_token) {
        sendgridKeys.set(integration.organization_id, integration.access_token);
      }
    }

    // Send nudges
    for (const [hireEmail, tasks] of tasksByHire) {
      const firstTask = tasks[0];
      const hireName = firstTask.plan.new_hire.full_name;
      const slackUserId = firstTask.plan.new_hire.slack_user_id;
      const orgId = (firstTask as unknown as { plan: { organization_id: string } }).plan.organization_id;

      // Send Slack DM if connected
      const slackToken = slackTokens.get(orgId);
      if (slackToken && slackUserId) {
        const blocks = [
          {
            type: "header",
            text: { type: "plain_text", text: `Good morning, ${hireName}! 🌅`, emoji: true },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `You have *${tasks.length}* onboarding ${tasks.length === 1 ? "task" : "tasks"} for today:`,
            },
          },
          ...tasks.map((t) => ({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `• *${t.title}*${t.description ? `\n  ${t.description}` : ""}${t.resources.length > 0 ? `\n  📎 ${t.resources.map((r) => `<${r.url}|${r.title}>`).join(", ")}` : ""}`,
            },
          })),
          { type: "divider" },
          {
            type: "context",
            elements: [
              { type: "mrkdwn", text: "💡 Mark tasks as complete in RampUp when you're done!" },
            ],
          },
        ];

        const sent = await sendSlackMessage(
          slackToken,
          slackUserId,
          blocks,
          `You have ${tasks.length} onboarding tasks for today`
        );
        if (sent) slackSent++;
      }

      // Send email nudge
      const sendgridKey = sendgridKeys.get(orgId) || Deno.env.get("SENDGRID_API_KEY");
      if (sendgridKey) {
        const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL") || "onboarding@rampup.app";
        const sent = await sendEmailNudge(sendgridKey, hireEmail, hireName, tasks, fromEmail);
        if (sent) emailSent++;
      }

      // Log notifications
      for (const task of tasks) {
        await supabase.from("notifications").insert({
          organization_id: orgId,
          user_id: (task as unknown as { plan: { new_hire_id: string } }).plan.new_hire_id,
          channel: slackUserId ? "slack" : "email",
          subject: "Daily onboarding task reminder",
          body: `Task due today: ${task.title}`,
          sent_at: new Date().toISOString(),
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Daily nudges sent",
        stats: {
          total_tasks: todayTasks.length,
          unique_hires: tasksByHire.size,
          slack_sent: slackSent,
          email_sent: emailSent,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
