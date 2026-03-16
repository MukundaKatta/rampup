import { getAnthropicClient, AI_MODEL, MAX_TOKENS } from "./client";

export interface ContentRequest {
  type: "summary" | "quiz" | "checklist" | "faq" | "guide";
  sourceDocuments: Array<{
    title: string;
    content: string;
  }>;
  targetRole?: string;
  targetDepartment?: string;
  additionalContext?: string;
}

export interface GeneratedContent {
  title: string;
  content: string;
  format: "markdown" | "html";
  estimatedReadingMinutes: number;
}

export async function createTrainingContent(request: ContentRequest): Promise<GeneratedContent> {
  const client = getAnthropicClient();

  const docContent = request.sourceDocuments
    .map((d) => `### ${d.title}\n${d.content.substring(0, 3000)}`)
    .join("\n\n---\n\n");

  const typeInstructions: Record<string, string> = {
    summary:
      "Create a concise executive summary that captures the key points. Use bullet points for clarity. Highlight action items and important policies.",
    quiz:
      "Create a knowledge check quiz with 8-10 multiple choice questions. Include the correct answers and brief explanations. Format as a clear, easy-to-follow quiz.",
    checklist:
      "Create a detailed step-by-step checklist that a new hire can follow. Include clear action items with descriptions. Group related items under headings.",
    faq:
      "Create a comprehensive FAQ document anticipating common questions a new hire would have. Include clear, helpful answers. Organize by topic.",
    guide:
      "Create a practical quick-start guide that helps a new hire get up to speed. Include tips, common pitfalls, and best practices. Make it actionable and friendly.",
  };

  const prompt = `You are creating onboarding training content for new employees.

CONTENT TYPE: ${request.type}
${request.targetRole ? `TARGET ROLE: ${request.targetRole}` : ""}
${request.targetDepartment ? `DEPARTMENT: ${request.targetDepartment}` : ""}
${request.additionalContext ? `ADDITIONAL CONTEXT: ${request.additionalContext}` : ""}

INSTRUCTIONS: ${typeInstructions[request.type]}

SOURCE DOCUMENTS:
${docContent}

Generate well-structured, professional content in Markdown format. Make it engaging and practical for new hires.

Return ONLY valid JSON:
{
  "title": "A clear, descriptive title",
  "content": "Full markdown content here",
  "estimated_reading_minutes": 5
}`;

  const message = await client.messages.create({
    model: AI_MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("Failed to parse AI-generated content");
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    title: parsed.title,
    content: parsed.content,
    format: "markdown",
    estimatedReadingMinutes: parsed.estimated_reading_minutes || 5,
  };
}

export async function generateDocumentSummary(
  title: string,
  content: string,
  maxLength: number = 500
): Promise<string> {
  const client = getAnthropicClient();

  const message = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `Summarize this company document for a new employee in ${maxLength} characters or less. Be clear, concise, and highlight what's most important for someone just joining the company.

Document: "${title}"

Content:
${content.substring(0, 5000)}

Return only the summary text, no JSON or formatting.`,
      },
    ],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}
