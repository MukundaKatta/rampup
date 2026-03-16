import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrgSettingsForm } from "@/components/settings/org-settings-form";
import { IntegrationsPanel } from "@/components/settings/integrations-panel";
import { BillingPanel } from "@/components/settings/billing-panel";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: currentUser } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("id", authUser.id)
    .single();
  if (!currentUser) redirect("/login");

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", currentUser.organization_id)
    .single();
  if (!organization) redirect("/login");

  const { data: integrations } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("organization_id", currentUser.organization_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your organization and integrations</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <OrgSettingsForm organization={organization} />
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <IntegrationsPanel integrations={integrations || []} orgId={organization.id} />
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <BillingPanel organization={organization} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
