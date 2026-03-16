"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar, MessageSquare, Sparkles, Loader2 } from "lucide-react";
import { formatDate, getStatusColor } from "@/lib/utils";
import type { CheckIn } from "@/types";

interface CheckInListProps {
  checkIns: CheckIn[];
  planId: string;
}

export function CheckInList({ checkIns, planId }: CheckInListProps) {
  const [selectedCheckIn, setSelectedCheckIn] = useState<CheckIn | null>(null);
  const [notes, setNotes] = useState("");
  const [moodRating, setMoodRating] = useState(3);
  const [confidenceRating, setConfidenceRating] = useState(3);
  const [highlights, setHighlights] = useState("");
  const [blockers, setBlockers] = useState("");
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function generateQuestions(checkIn: CheckIn) {
    setLoadingQuestions(true);
    try {
      const response = await fetch("/api/ai/check-in-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          checkInId: checkIn.id,
          checkInDay: checkIn.check_in_day,
        }),
      });

      const data = await response.json();
      if (data.questions) {
        setAiQuestions(data.questions);
      }
    } catch (error) {
      console.error("Failed to generate questions:", error);
    } finally {
      setLoadingQuestions(false);
    }
  }

  async function completeCheckIn() {
    if (!selectedCheckIn) return;
    setSaving(true);

    await supabase
      .from("check_ins")
      .update({
        status: "completed",
        notes,
        mood_rating: moodRating,
        confidence_rating: confidenceRating,
        highlights: highlights.split("\n").filter(Boolean),
        blockers: blockers.split("\n").filter(Boolean),
        completed_at: new Date().toISOString(),
      })
      .eq("id", selectedCheckIn.id);

    setSaving(false);
    setSelectedCheckIn(null);
    setNotes("");
    setHighlights("");
    setBlockers("");
    setAiQuestions([]);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {checkIns.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No check-ins scheduled yet.
          </CardContent>
        </Card>
      ) : (
        checkIns.map((checkIn) => (
          <Card key={checkIn.id} className="transition-colors hover:bg-muted/50">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">Day {checkIn.check_in_day} Check-in</h3>
                    <Badge className={getStatusColor(checkIn.status)}>{checkIn.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(checkIn.scheduled_date)}
                    {checkIn.scheduled_time && ` at ${checkIn.scheduled_time}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {checkIn.status === "scheduled" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCheckIn(checkIn);
                        generateQuestions(checkIn);
                      }}
                    >
                      <Sparkles className="mr-1 h-3 w-3" />
                      Prepare
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setSelectedCheckIn(checkIn)}
                    >
                      Complete
                    </Button>
                  </>
                )}
                {checkIn.status === "completed" && checkIn.mood_rating && (
                  <div className="flex items-center gap-4 text-sm">
                    <span>
                      Mood: <strong>{checkIn.mood_rating}/5</strong>
                    </span>
                    <span>
                      Confidence: <strong>{checkIn.confidence_rating}/5</strong>
                    </span>
                  </div>
                )}
              </div>
            </CardContent>

            {checkIn.status === "completed" && (checkIn.notes || checkIn.highlights.length > 0) && (
              <CardContent className="border-t px-4 pb-4 pt-3">
                {checkIn.notes && <p className="text-sm text-muted-foreground">{checkIn.notes}</p>}
                {checkIn.highlights.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-green-700">Highlights:</p>
                    <ul className="mt-1 text-sm text-muted-foreground">
                      {checkIn.highlights.map((h, i) => (
                        <li key={i}>- {h}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {checkIn.blockers.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-red-700">Blockers:</p>
                    <ul className="mt-1 text-sm text-muted-foreground">
                      {checkIn.blockers.map((b, i) => (
                        <li key={i}>- {b}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        ))
      )}

      {/* Check-in Dialog */}
      <Dialog open={!!selectedCheckIn} onOpenChange={() => setSelectedCheckIn(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Day {selectedCheckIn?.check_in_day} Check-in</DialogTitle>
            <DialogDescription>
              Record the outcomes of this check-in session
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* AI Questions */}
            {(loadingQuestions || aiQuestions.length > 0) && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-purple-700">
                  <Sparkles className="h-4 w-4" />
                  AI-Suggested Questions
                </div>
                {loadingQuestions ? (
                  <div className="mt-2 flex items-center gap-2 text-sm text-purple-600">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Generating questions...
                  </div>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm text-purple-800">
                    {aiQuestions.map((q, i) => (
                      <li key={i}>- {q}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Ratings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Mood (1-5)</label>
                <div className="mt-1 flex gap-1">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setMoodRating(r)}
                      className={`h-8 w-8 rounded ${r <= moodRating ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Confidence (1-5)</label>
                <div className="mt-1 flex gap-1">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setConfidenceRating(r)}
                      className={`h-8 w-8 rounded ${r <= confidenceRating ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Highlights (one per line)</label>
              <Textarea
                placeholder="What went well..."
                value={highlights}
                onChange={(e) => setHighlights(e.target.value)}
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Blockers (one per line)</label>
              <Textarea
                placeholder="Any challenges or blockers..."
                value={blockers}
                onChange={(e) => setBlockers(e.target.value)}
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                placeholder="Additional notes from the check-in..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCheckIn(null)}>
              Cancel
            </Button>
            <Button onClick={completeCheckIn} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete Check-in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
