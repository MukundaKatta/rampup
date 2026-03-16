"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { MessageSquare, Calendar, HardDrive, Mail, Check, X, Loader2 } from "lucide-react";
import type { IntegrationConnection } from "@/types";

const integrationMeta = {
  slack: {
    name: "Slack",
    description: "Send daily task reminders, welcome messages, and progress updates via Slack DMs.",
    icon: MessageSquare,
    color: "text-purple-600 bg-purple-100",
    fields: [{ key: "bot_token", label: "Bot Token", placeholder: "xoxb-..." }],
  },
  google_calendar: {
    name: "Google Calendar",
    description: "Auto-schedule check-in meetings and training sessions on Google Calendar.",
    icon: Calendar,
    color: "text-blue-600 bg-blue-100",
    fields: [
      { key: "client_id", label: "Client ID", placeholder: "..." },
      { key: "client_secret", label: "Client Secret", placeholder: "..." },
    ],
  },
  google_drive: {
    name: "Google Drive",
    description: "Import company documents from Google Drive for AI-powered content generation.",
    icon: HardDrive,
    color: "text-green-600 bg-green-100",
    fields: [
      { key: "client_id", label: "Client ID", placeholder: "..." },
      { key: "folder_id", label: "Folder ID", placeholder: "..." },
    ],
  },
  sendgrid: {
    name: "SendGrid",
    description: "Send welcome emails, task reminders, and weekly digest emails.",
    icon: Mail,
    color: "text-cyan-600 bg-cyan-100",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "SG...." },
      { key: "from_email", label: "From Email", placeholder: "onboarding@company.com" },
    ],
  },
} as const;

interface IntegrationsPanelProps {
  integrations: IntegrationConnection[];
  orgId: string;
}

export function IntegrationsPanel({ integrations, orgId }: IntegrationsPanelProps) {
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const connectedMap = new Map(integrations.map((i) => [i.provider, i]));

  async function handleConnect(provider: string) {
    setLoading(true);
    try {
      const response = await fetch("/api/integrations/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, config: fieldValues, orgId }),
      });

      if (response.ok) {
        setConfiguring(null);
        setFieldValues({});
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect(provider: string) {
    setLoading(true);
    try {
      const response = await fetch(`/api/integrations/slack?provider=${provider}&orgId=${orgId}`, {
        method: "DELETE",
      });
      if (response.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {(Object.entries(integrationMeta) as Array<[string, (typeof integrationMeta)[keyof typeof integrationMeta]]>).map(
        ([key, meta]) => {
          const connection = connectedMap.get(key as IntegrationConnection["provider"]);
          const isConnected = connection?.is_active;

          return (
            <Card key={key}>
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className={`rounded-lg p-3 ${meta.color}`}>
                    <meta.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{meta.name}</h3>
                      {isConnected ? (
                        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                          <Check className="mr-1 h-3 w-3" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Not connected
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{meta.description}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {isConnected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(key)}
                      disabled={loading}
                    >
                      <X className="mr-1 h-3 w-3" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setConfiguring(key)}>
                      Connect
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        }
      )}

      {/* Configuration Dialog */}
      <Dialog open={!!configuring} onOpenChange={() => setConfiguring(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Connect {configuring ? integrationMeta[configuring as keyof typeof integrationMeta]?.name : ""}
            </DialogTitle>
            <DialogDescription>
              Enter the credentials to connect this integration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {configuring &&
              integrationMeta[configuring as keyof typeof integrationMeta]?.fields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label>{field.label}</Label>
                  <Input
                    type={field.key.includes("secret") || field.key.includes("token") || field.key.includes("key") ? "password" : "text"}
                    placeholder={field.placeholder}
                    value={fieldValues[field.key] || ""}
                    onChange={(e) => setFieldValues({ ...fieldValues, [field.key]: e.target.value })}
                  />
                </div>
              ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfiguring(null)}>Cancel</Button>
            <Button onClick={() => configuring && handleConnect(configuring)} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
