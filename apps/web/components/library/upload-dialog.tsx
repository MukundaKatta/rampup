"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Upload, Loader2 } from "lucide-react";

export function UploadDocumentDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [documentType, setDocumentType] = useState("other");
  const [tags, setTags] = useState("");
  const [department, setDepartment] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [contentText, setContentText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          documentType,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          department: department || null,
          isRequiredReading: isRequired,
          contentText,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      setOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setDocumentType("other");
    setTags("");
    setDepartment("");
    setIsRequired(false);
    setContentText("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Add a document to the knowledge base for AI-powered onboarding content.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="docTitle">Title</Label>
              <Input
                id="docTitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Employee Handbook"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="docDescription">Description</Label>
              <Input
                id="docDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Overview of company policies and procedures"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Document Type</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="handbook">Handbook</SelectItem>
                    <SelectItem value="wiki">Wiki</SelectItem>
                    <SelectItem value="process">Process</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="policy">Policy</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="docDepartment">Department</Label>
                <Input
                  id="docDepartment"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Engineering"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="docTags">Tags (comma-separated)</Label>
              <Input
                id="docTags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="onboarding, setup, tools"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="docContent">Content</Label>
              <Textarea
                id="docContent"
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                placeholder="Paste the document content here. The AI will use this to generate onboarding materials..."
                rows={8}
                required
                disabled={loading}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="docRequired"
                checked={isRequired}
                onCheckedChange={(checked) => setIsRequired(checked === true)}
              />
              <Label htmlFor="docRequired" className="cursor-pointer">
                Required reading for all new hires
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
