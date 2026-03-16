"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { Organization } from "@/types";
import type { OrgSettings } from "@rampup/supabase";

interface OrgSettingsFormProps {
  organization: Organization;
}

const timezones = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Anchorage", "Pacific/Honolulu", "Europe/London", "Europe/Paris",
  "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai", "Asia/Kolkata",
  "Australia/Sydney", "Pacific/Auckland",
];

export function OrgSettingsForm({ organization }: OrgSettingsFormProps) {
  const settings = organization.settings as OrgSettings;
  const [name, setName] = useState(organization.name);
  const [domain, setDomain] = useState(organization.domain || "");
  const [timezone, setTimezone] = useState(settings.timezone);
  const [nudgeTime, setNudgeTime] = useState(settings.daily_nudge_time);
  const [digestDay, setDigestDay] = useState(String(settings.weekly_digest_day));
  const [planDuration, setPlanDuration] = useState(String(settings.default_plan_duration_days));
  const [autoCheckIns, setAutoCheckIns] = useState(settings.auto_schedule_checkins);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);

    await supabase
      .from("organizations")
      .update({
        name,
        domain: domain || null,
        settings: {
          ...settings,
          timezone,
          daily_nudge_time: nudgeTime,
          weekly_digest_day: parseInt(digestDay),
          default_plan_duration_days: parseInt(planDuration),
          auto_schedule_checkins: autoCheckIns,
        },
      })
      .eq("id", organization.id);

    setLoading(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Settings</CardTitle>
        <CardDescription>Configure your organization&apos;s onboarding preferences</CardDescription>
      </CardHeader>
      <form onSubmit={handleSave}>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input id="orgName" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgDomain">Domain</Label>
              <Input id="orgDomain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="company.com" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nudgeTime">Daily Nudge Time</Label>
              <Input id="nudgeTime" type="time" value={nudgeTime} onChange={(e) => setNudgeTime(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Weekly Digest Day</Label>
              <Select value={digestDay} onValueChange={setDigestDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="2">Tuesday</SelectItem>
                  <SelectItem value="3">Wednesday</SelectItem>
                  <SelectItem value="4">Thursday</SelectItem>
                  <SelectItem value="5">Friday</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="planDuration">Default Plan Duration (days)</Label>
              <Input
                id="planDuration"
                type="number"
                min={30}
                max={180}
                value={planDuration}
                onChange={(e) => setPlanDuration(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoCheckIns"
              checked={autoCheckIns}
              onChange={(e) => setAutoCheckIns(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="autoCheckIns" className="cursor-pointer">
              Auto-schedule check-ins at Day 7, 14, 30, 60, 90
            </Label>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Settings
            </Button>
            {saved && <span className="text-sm text-green-600">Settings saved successfully</span>}
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
