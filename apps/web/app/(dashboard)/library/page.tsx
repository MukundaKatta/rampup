import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Upload, BookOpen, Globe, FileCheck, Shield, HelpCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { UploadDocumentDialog } from "@/components/library/upload-dialog";

const docTypeIcons: Record<string, React.ReactNode> = {
  handbook: <BookOpen className="h-5 w-5" />,
  wiki: <Globe className="h-5 w-5" />,
  process: <FileCheck className="h-5 w-5" />,
  training: <FileText className="h-5 w-5" />,
  policy: <Shield className="h-5 w-5" />,
  other: <HelpCircle className="h-5 w-5" />,
};

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: currentUser } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", authUser.id)
    .single();
  if (!currentUser) redirect("/login");

  const { data: documents } = await supabase
    .from("documents")
    .select("*, uploaded_by_user:users!documents_uploaded_by_fkey(full_name)")
    .eq("organization_id", currentUser.organization_id)
    .order("created_at", { ascending: false });

  const groupedDocs = (documents || []).reduce(
    (acc, doc) => {
      const type = doc.document_type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(doc);
      return acc;
    },
    {} as Record<string, typeof documents>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Document Library</h1>
          <p className="text-muted-foreground">
            {documents?.length || 0} documents for onboarding content generation
          </p>
        </div>
        <UploadDocumentDialog />
      </div>

      {!documents || documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No documents yet</h3>
            <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
              Upload company handbooks, wikis, and process documents. The AI will use them to generate
              personalized onboarding plans.
            </p>
            <UploadDocumentDialog />
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedDocs).map(([type, docs]) => (
          <div key={type}>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-muted-foreground">{docTypeIcons[type]}</span>
              <h2 className="text-lg font-semibold capitalize">{type}</h2>
              <Badge variant="secondary">{docs!.length}</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {docs!.map((doc) => {
                const uploader = (doc as Record<string, unknown>).uploaded_by_user as { full_name: string } | null;
                return (
                  <Card key={doc.id} className="transition-colors hover:bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                          {docTypeIcons[doc.document_type]}
                        </div>
                        <div className="flex-1 space-y-1">
                          <h3 className="font-medium leading-tight">{doc.title}</h3>
                          {doc.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{doc.description}</p>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {doc.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {doc.is_required_reading && (
                              <Badge variant="destructive" className="text-xs">Required</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {doc.file_name && <span>{doc.file_name}</span>}
                            <span>{formatDate(doc.created_at)}</span>
                            {uploader && <span>by {uploader.full_name}</span>}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
