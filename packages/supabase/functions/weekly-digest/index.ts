import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PlanDigest {
  plan_id: string;
  plan_title: string;
  new_hire_name: string;
  new_hire_email: string;
  manager_name: string;
  manager_email: string;
  manager_slack_id: string | null;
  org_name: string;
  org_id: string;
  start_date: string;
  completion_pct: number;
  tasks_completed_this_week: number;
  tasks_due_next_week: number;
  overdue_count: number;
  upcoming_checkin: string | null;
  on_track: boolean;
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

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const todayStr = today.toISOString().split("T")[0];
    const weekAgoStr = weekAgo.toISOString().split("T")[0];
    const nextWeekStr = nextWeek.toISOString().split("T")[0];

    // Get all active onboarding plans with their context
    const { data: activePlans, error: plansError } = await supabase
      .from("onboarding_plans")
      .select(`
        id, title, start_date, completion_percentage, organization_id,
        new_hire:users!onboarding_plans_new_hire_id_fkey(full_name, email),
        manager:users!onboarding_plans_manager_id_fkey(full_name, email, slack_user_id),
        organization:organizations!inner(name)
      `)
      .eq("status", "active");

    if (plansError) {
      throw new Error(`Failed to fetch plans: ${plansError.message}`);
    }

    if (!activePlans || activePlans.length === 0) {
      return new Response(JSON.stringify({ message: "No active plans", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const digests: PlanDigest[] = [];

    for (const plan of activePlans) {
      // Tasks completed this week
      const { count: completedThisWeek } = await supabase
        .from("plan_tasks")
        .select("*", { count: "exact", head: true })
        .eq("plan_id", plan.id)
        .eq("status", "completed")
        .gte("completed_at", weekAgoStr)
        .lte("completed_at", todayStr);

      // Tasks due next week
      const { count: dueNextWeek } = await supabase
        .from("plan_tasks")
        .select("*", { count: "exact", head: true })
        .eq("plan_id", plan.id)
        .in("status", ["pending", "in_progress"])
        .gte("due_date", todayStr)
        .lte("due_date", nextWeekStr);

      // Overdue tasks
      const { count: overdueCount } = await supabase
        .from("plan_tasks")
        .select("*", { count: "exact", head: true })
        .eq("plan_id", plan.id)
        .eq("status", "overdue");

      // Next check-in
      const { data: nextCheckin } = await supabase
        .from("check_ins")
        .select("scheduled_date")
        .eq("plan_id", plan.id)
        .eq("status", "scheduled")
        .gte("scheduled_date", todayStr)
        .order("scheduled_date", { ascending: true })
        .limit(1)
        .single();

      const newHire = plan.new_hire as unknown as { full_name: string; email: string };
      const manager = plan.manager as unknown as { full_name: string; email: string; slack_user_id: string | null };
      const org = plan.organization as unknown as { name: string };

      digests.push({
        plan_id: plan.id,
        plan_title: plan.title,
        new_hire_name: newHire.full_name,
        new_hire_email: newHire.email,
        manager_name: manager.full_name,
        manager_email: manager.email,
        manager_slack_id: manager.slack_user_id,
        org_name: org.name,
        org_id: plan.organization_id,
        start_date: plan.start_date,
        completion_pct: plan.completion_percentage,
        tasks_completed_this_week: completedThisWeek || 0,
        tasks_due_next_week: dueNextWeek || 0,
        overdue_count: overdueCount || 0,
        upcoming_checkin: nextCheckin?.scheduled_date || null,
        on_track: (overdueCount || 0) === 0,
      });
    }

    // Group digests by manager
    const digestsByManager = new Map<string, PlanDigest[]>();
    for (const digest of digests) {
      if (!digestsByManager.has(digest.manager_email)) {
        digestsByManager.set(digest.manager_email, []);
      }
      digestsByManager.get(digest.manager_email)!.push(digest);
    }

    let emailsSent = 0;
    let slacksSent = 0;

    for (const [managerEmail, managerDigests] of digestsByManager) {
      const managerName = managerDigests[0].manager_name;

      // Build email HTML
      const planSummaries = managerDigests
        .map(
          (d) => `
          <div style="background: ${d.on_track ? "#f0fdf4" : "#fef2f2"}; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <h3 style="margin: 0 0 8px 0; color: #1a1a2e;">
              ${d.on_track ? "✅" : "⚠️"} ${d.new_hire_name} - ${d.plan_title}
            </h3>
            <table style="width: 100%; font-size: 14px; color: #444;">
              <tr><td><strong>Progress:</strong></td><td>${d.completion_pct}%</td></tr>
              <tr><td><strong>Completed this week:</strong></td><td>${d.tasks_completed_this_week} tasks</td></tr>
              <tr><td><strong>Due next week:</strong></td><td>${d.tasks_due_next_week} tasks</td></tr>
              ${d.overdue_count > 0 ? `<tr><td><strong style="color: #dc2626;">Overdue:</strong></td><td style="color: #dc2626;">${d.overdue_count} tasks</td></tr>` : ""}
              ${d.upcoming_checkin ? `<tr><td><strong>Next check-in:</strong></td><td>${d.upcoming_checkin}</td></tr>` : ""}
            </table>
          </div>`
        )
        .join("");

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a2e;">Weekly Onboarding Digest</h2>
          <p>Hi ${managerName}, here's a summary of your team's onboarding progress:</p>
          ${planSummaries}
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
          <p style="color: #999; font-size: 12px;">Sent by RampUp - Your onboarding autopilot</p>
        </div>
      `;

      // Send email
      const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
      if (sendgridKey) {
        const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL") || "onboarding@rampup.app";
        const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sendgridKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: managerEmail, name: managerName }] }],
            from: { email: fromEmail, name: "RampUp" },
            subject: `Weekly Onboarding Digest - ${managerDigests.length} active ${managerDigests.length === 1 ? "onboarding" : "onboardings"}`,
            content: [{ type: "text/html", value: html }],
          }),
        });

        if (response.status === 202) emailsSent++;
      }

      // Send Slack summary
      const slackId = managerDigests[0].manager_slack_id;
      const orgId = managerDigests[0].org_id;
      if (slackId) {
        const { data: slackIntegration } = await supabase
          .from("integration_connections")
          .select("access_token")
          .eq("organization_id", orgId)
          .eq("provider", "slack")
          .eq("is_active", true)
          .single();

        if (slackIntegration?.access_token) {
          const blocks = [
            {
              type: "header",
              text: { type: "plain_text", text: "📊 Weekly Onboarding Digest", emoji: true },
            },
            ...managerDigests.flatMap((d) => [
              { type: "divider" },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `${d.on_track ? "✅" : "⚠️"} *${d.new_hire_name}* - ${d.plan_title}\n` +
                    `Progress: *${d.completion_pct}%* | Completed: *${d.tasks_completed_this_week}* | Due next week: *${d.tasks_due_next_week}*` +
                    (d.overdue_count > 0 ? `\n🔴 *${d.overdue_count} overdue tasks*` : ""),
                },
              },
            ]),
          ];

          const response = await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${slackIntegration.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              channel: slackId,
              blocks,
              text: `Weekly onboarding digest: ${managerDigests.length} active onboardings`,
            }),
          });

          const data = await response.json();
          if (data.ok) slacksSent++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "Weekly digests sent",
        stats: {
          active_plans: digests.length,
          managers_notified: digestsByManager.size,
          emails_sent: emailsSent,
          slacks_sent: slacksSent,
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
