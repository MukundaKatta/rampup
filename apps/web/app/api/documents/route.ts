import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const body = await request.json();
    const {
      title,
      description,
      documentType = "other",
      tags = [],
      department,
      isRequiredReading = false,
      contentText,
    } = body;

    if (!title || !contentText) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    }

    const { data: document, error } = await supabase
      .from("documents")
      .insert({
        organization_id: currentUser.organization_id,
        title,
        description: description || null,
        document_type: documentType,
        tags,
        department: department || null,
        is_required_reading: isRequiredReading,
        content_text: contentText,
        uploaded_by: authUser.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ document });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", authUser.id)
      .single();

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const department = searchParams.get("department");

    let query = supabase
      .from("documents")
      .select("*")
      .eq("organization_id", currentUser.organization_id)
      .order("created_at", { ascending: false });

    if (type) query = query.eq("document_type", type);
    if (department) query = query.eq("department", department);

    const { data: documents, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ documents });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
