import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTrainingContent } from "@rampup/ai-engine";
import type { ContentRequest } from "@rampup/ai-engine";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { type, documentIds, targetRole, targetDepartment, additionalContext } = await request.json();

    if (!type || !documentIds?.length) {
      return NextResponse.json({ error: "type and documentIds are required" }, { status: 400 });
    }

    // Fetch source documents
    const { data: documents, error: docError } = await supabase
      .from("documents")
      .select("title, content_text")
      .in("id", documentIds)
      .not("content_text", "is", null);

    if (docError || !documents?.length) {
      return NextResponse.json({ error: "No documents found" }, { status: 404 });
    }

    const contentRequest: ContentRequest = {
      type,
      sourceDocuments: documents.map((d) => ({
        title: d.title,
        content: d.content_text || "",
      })),
      targetRole,
      targetDepartment,
      additionalContext,
    };

    const content = await createTrainingContent(contentRequest);

    return NextResponse.json({ content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
