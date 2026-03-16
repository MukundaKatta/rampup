import { getAnthropicClient, AI_MODEL } from "./client";

export interface ProgressData {
  newHireName: string;
  roleName: string;
  dayNumber: number;
  totalDays: number;
  completionPercentage: number;
  tasksCompleted: number;
  tasksTotal: number;
  overdueCount: number;
  averageTaskRating: number | null;
  averageTimeSpentMinutes: number | null;
  checkInMoodRatings: number[];
  checkInConfidenceRatings: number[];
  blockers: string[];
  recentFeedback: string[];
  metricsHistory: Array<{
    dayNumber: number;
    completionPercentage: number;
    onTrack: boolean;
  }>;
}

export interface ProgressAnalysis {
  overallStatus: "ahead" | "on_track" | "at_risk" | "behind";
  summary: string;
  strengths: string[];
  areasOfConcern: string[];
  recommendations: string[];
  predictedCompletionDate: string | null;
  engagementTrend: "improving" | "stable" | "declining";
  managerActionItems: string[];
}

export async function analyzeProgress(data: ProgressData): Promise<ProgressAnalysis> {
  const client = getAnthropicClient();

  const metricsTimeline = data.metricsHistory
    .map((m) => `Day ${m.dayNumber}: ${m.completionPercentage}% complete, ${m.onTrack ? "on track" : "off track"}`)
    .join("\n");

  const prompt = `You are an HR analytics expert analyzing an employee's onboarding progress.

ONBOARDING DATA:
- Employee: ${data.newHireName}
- Role: ${data.roleName}
- Current Day: ${data.dayNumber} of ${data.totalDays}
- Expected Progress: ${Math.round((data.dayNumber / data.totalDays) * 100)}%
- Actual Progress: ${data.completionPercentage}%
- Tasks: ${data.tasksCompleted}/${data.tasksTotal} completed
- Overdue: ${data.overdueCount} tasks
${data.averageTaskRating !== null ? `- Average Task Rating: ${data.averageTaskRating}/5` : ""}
${data.checkInMoodRatings.length > 0 ? `- Mood Ratings: ${data.checkInMoodRatings.join(", ")}/5` : ""}
${data.checkInConfidenceRatings.length > 0 ? `- Confidence Ratings: ${data.checkInConfidenceRatings.join(", ")}/5` : ""}
${data.blockers.length > 0 ? `- Active Blockers: ${data.blockers.join("; ")}` : ""}
${data.recentFeedback.length > 0 ? `- Recent Feedback: ${data.recentFeedback.join("; ")}` : ""}

PROGRESS TIMELINE:
${metricsTimeline || "No historical data yet"}

Analyze the onboarding progress and provide actionable insights.

Return ONLY valid JSON:
{
  "overall_status": "ahead|on_track|at_risk|behind",
  "summary": "2-3 sentence executive summary of progress",
  "strengths": ["2-3 positive observations"],
  "areas_of_concern": ["0-3 concerns, empty array if none"],
  "recommendations": ["3-5 specific actionable recommendations"],
  "predicted_completion_date": "YYYY-MM-DD or null if insufficient data",
  "engagement_trend": "improving|stable|declining",
  "manager_action_items": ["2-4 specific things the manager should do"]
}`;

  const message = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("Failed to parse AI progress analysis");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    overallStatus: parsed.overall_status,
    summary: parsed.summary,
    strengths: parsed.strengths,
    areasOfConcern: parsed.areas_of_concern,
    recommendations: parsed.recommendations,
    predictedCompletionDate: parsed.predicted_completion_date,
    engagementTrend: parsed.engagement_trend,
    managerActionItems: parsed.manager_action_items,
  };
}
