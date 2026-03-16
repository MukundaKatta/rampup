import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createGoogleDriveClient } from "@rampup/integrations";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", authUser.id)
      .single();

    if (!currentUser || !["owner", "admin", "manager"].includes(currentUser.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Get Google Drive integration
    const { data: integration } = await supabase
      .from("integration_connections")
      .select("access_token, config")
      .eq("organization_id", currentUser.organization_id)
      .eq("provider", "google_drive")
      .eq("is_active", true)
      .single();

    if (!integration?.access_token) {
      return NextResponse.json({ error: "Google Drive not connected" }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body;
    const drive = createGoogleDriveClient(integration.access_token);

    switch (action) {
      case "list_files": {
        const folderId = body.folderId || (integration.config as Record<string, string>)?.folder_id;
        const files = await drive.listDocuments(folderId);
        return NextResponse.json({ files });
      }

      case "import_file": {
        const { fileId } = body;
        if (!fileId) return NextResponse.json({ error: "fileId required" }, { status: 400 });

        const content = await drive.getFileContent(fileId);

        // Save to documents table
        const { data: document, error: docError } = await supabase
          .from("documents")
          .insert({
            organization_id: currentUser.organization_id,
            title: content.name,
            document_type: "other",
            google_drive_id: content.id,
            content_text: content.textContent,
            mime_type: content.mimeType,
            uploaded_by: authUser.id,
          })
          .select()
          .single();

        if (docError) {
          return NextResponse.json({ error: docError.message }, { status: 500 });
        }

        return NextResponse.json({ document });
      }

      case "import_folder": {
        const folderId = body.folderId || (integration.config as Record<string, string>)?.folder_id;
        if (!folderId) return NextResponse.json({ error: "folderId required" }, { status: 400 });

        const contents = await drive.importFolder(folderId);

        const documents = [];
        for (const content of contents) {
          const { data: doc } = await supabase
            .from("documents")
            .insert({
              organization_id: currentUser.organization_id,
              title: content.name,
              document_type: "other",
              google_drive_id: content.id,
              content_text: content.textContent,
              mime_type: content.mimeType,
              uploaded_by: authUser.id,
            })
            .select()
            .single();

          if (doc) documents.push(doc);
        }

        return NextResponse.json({ imported: documents.length, documents });
      }

      case "search": {
        const { query } = body;
        if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });
        const files = await drive.searchFiles(query);
        return NextResponse.json({ files });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
