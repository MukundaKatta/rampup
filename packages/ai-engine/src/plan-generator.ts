import { getAnthropicClient, AI_MODEL, MAX_TOKENS } from "./client";
import type { TaskType, PlanPhase, Resource } from "@rampup/supabase";

export interface RoleContext {
  title: string;
  department: string;
  level?: string;
  requiredSkills: string[];
  toolsAndAccess: string[];
  keyStakeholders: string[];
  description?: string;
}

export interface NewHireContext {
  fullName: string;
  startDate: string;
  managerName: string;
  managerTitle: string;
  buddyName?: string;
}

export interface DocumentContext {
  title: string;
  type: string;
  summary: string;
}

export interface GeneratedTask {
  title: string;
  description: string;
  taskType: TaskType;
  dayOffset: number;
  durationMinutes: number;
  isRequired: boolean;
  assigneeRole: "new_hire" | "manager" | "buddy" | "it";
  phaseName: string;
  resources: Resource[];
}

export interface GeneratedPlan {
  phases: PlanPhase[];
  tasks: GeneratedTask[];
}

export interface ExistingTemplateTask {
  title: string;
  description?: string;
  taskType: string;
  dayOffset: number;
}

export async function generateOnboardingPlan(
  role: RoleContext,
  newHire: NewHireContext,
  documents: DocumentContext[],
  existingTemplateTasks: ExistingTemplateTask[] = [],
  durationDays: number = 90
): Promise<GeneratedPlan> {
  const client = getAnthropicClient();

  const docSummaries = documents
    .map((d) => `- ${d.title} (${d.type}): ${d.summary}`)
    .join("\n");

  const templateTaskList = existingTemplateTasks
    .map((t) => `- Day ${t.dayOffset}: [${t.taskType}] ${t.title} - ${t.description || ""}`)
    .join("\n");

  const prompt = `You are an expert employee onboarding specialist. Generate a comprehensive ${durationDays}-day onboarding plan.

NEW HIRE DETAILS:
- Name: ${newHire.fullName}
- Role: ${role.title}
- Department: ${role.department}
- Level: ${role.level || "Not specified"}
- Required Skills: ${role.requiredSkills.join(", ") || "Not specified"}
- Tools & Access Needed: ${role.toolsAndAccess.join(", ") || "Not specified"}
- Key Stakeholders: ${role.keyStakeholders.join(", ") || "Not specified"}
- Manager: ${newHire.managerName} (${newHire.managerTitle})
${newHire.buddyName ? `- Buddy: ${newHire.buddyName}` : ""}
- Start Date: ${newHire.startDate}

${templateTaskList ? `EXISTING TEMPLATE TASKS (enhance and supplement):\n${templateTaskList}\n` : ""}

COMPANY DOCUMENTS:
${docSummaries || "No documents uploaded yet."}

Generate tasks organized into these phases:
1. Orientation (Days 1-14): Setup environment, meet the team, review core docs
2. Learning (Days 15-30): Shadow sessions, training, first small contributions
3. Contributing (Days 31-60): Independent work, first meaningful project, deeper integration
4. Ownership (Days 61-${durationDays}): Full ownership of responsibilities, performance review prep

For EACH task provide:
- title: Clear actionable name (max 80 chars)
- description: Detailed instructions (2-3 sentences)
- task_type: reading | meeting | setup | training | project | social | review | custom
- day_offset: Day number (1-${durationDays})
- duration_minutes: Realistic estimate
- is_required: true for critical tasks, false for nice-to-haves
- assignee_role: new_hire | manager | buddy | it
- phase_name: Orientation | Learning | Contributing | Ownership
- resources: Array of {url: "", title: "Resource name", type: "doc|video|link"} if applicable

IMPORTANT GUIDELINES:
- Generate 40-60 well-thought-out tasks covering all onboarding aspects
- Include a mix of technical setup, knowledge acquisition, relationship building, and practical work
- First day should focus on essential setup and welcome activities
- Include specific document references from the company docs when available
- Schedule social activities (team lunches, coffee chats) throughout the plan
- Ensure tasks build on each other logically
- Include manager and buddy tasks (not just new hire tasks)
- Add review/reflection checkpoints at the end of each phase

Return ONLY valid JSON:
{
  "phases": [
    {"name": "Orientation", "start_day": 1, "end_day": 14, "description": "..."},
    {"name": "Learning", "start_day": 15, "end_day": 30, "description": "..."},
    {"name": "Contributing", "start_day": 31, "end_day": 60, "description": "..."},
    {"name": "Ownership", "start_day": 61, "end_day": ${durationDays}, "description": "..."}
  ],
  "tasks": [...]
}`;

  const message = await client.messages.create({
    model: AI_MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("Failed to parse AI-generated plan");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    phases: parsed.phases,
    tasks: parsed.tasks.map((t: Record<string, unknown>) => ({
      title: t.title as string,
      description: t.description as string,
      taskType: t.task_type as TaskType,
      dayOffset: t.day_offset as number,
      durationMinutes: t.duration_minutes as number,
      isRequired: t.is_required as boolean,
      assigneeRole: t.assignee_role as "new_hire" | "manager" | "buddy" | "it",
      phaseName: t.phase_name as string,
      resources: (t.resources as Resource[]) || [],
    })),
  };
}
