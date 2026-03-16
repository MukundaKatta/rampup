import { getAnthropicClient, AI_MODEL } from "./client";

export interface CheckInContext {
  newHireName: string;
  roleName: string;
  department: string;
  checkInDay: number;
  completionPercentage: number;
  tasksCompleted: number;
  tasksTotal: number;
  overdueTaskCount: number;
  recentCompletedTasks: string[];
  upcomingTasks: string[];
  previousCheckInNotes?: string;
  previousBlockers?: string[];
  previousMoodRating?: number;
}

export interface GeneratedCheckInQuestions {
  openingQuestions: string[];
  progressQuestions: string[];
  wellbeingQuestions: string[];
  forwardLookingQuestions: string[];
  suggestedTopics: string[];
}

export async function generateCheckInQuestions(
  context: CheckInContext
): Promise<GeneratedCheckInQuestions> {
  const client = getAnthropicClient();

  const prompt = `You are an experienced people manager preparing for a check-in with a new hire.

CHECK-IN CONTEXT:
- New Hire: ${context.newHireName}
- Role: ${context.roleName} (${context.department})
- This is the Day ${context.checkInDay} check-in
- Overall Progress: ${context.completionPercentage}% (${context.tasksCompleted}/${context.tasksTotal} tasks)
- Overdue Tasks: ${context.overdueTaskCount}
${context.previousCheckInNotes ? `- Previous Check-in Notes: ${context.previousCheckInNotes}` : ""}
${context.previousBlockers?.length ? `- Previous Blockers: ${context.previousBlockers.join(", ")}` : ""}
${context.previousMoodRating ? `- Previous Mood Rating: ${context.previousMoodRating}/5` : ""}

RECENTLY COMPLETED TASKS:
${context.recentCompletedTasks.map((t) => `- ${t}`).join("\n") || "None"}

UPCOMING TASKS:
${context.upcomingTasks.map((t) => `- ${t}`).join("\n") || "None"}

Generate thoughtful, empathetic check-in questions appropriate for Day ${context.checkInDay} of onboarding.

Day 7: Focus on initial impressions, setup completion, comfort level
Day 14: Focus on first relationships, initial understanding, early wins
Day 30: Focus on first month reflection, independence growth, team integration
Day 60: Focus on project contributions, deeper challenges, career development
Day 90: Focus on full integration, performance confidence, long-term goals

Return ONLY valid JSON:
{
  "opening_questions": ["2-3 warm, open-ended conversation starters"],
  "progress_questions": ["3-4 questions about task progress and learning"],
  "wellbeing_questions": ["2-3 questions about how they're feeling"],
  "forward_looking_questions": ["2-3 questions about what's next and support needed"],
  "suggested_topics": ["3-5 specific topics to discuss based on their progress"]
}`;

  const message = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("Failed to parse AI-generated check-in questions");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    openingQuestions: parsed.opening_questions,
    progressQuestions: parsed.progress_questions,
    wellbeingQuestions: parsed.wellbeing_questions,
    forwardLookingQuestions: parsed.forward_looking_questions,
    suggestedTopics: parsed.suggested_topics,
  };
}
