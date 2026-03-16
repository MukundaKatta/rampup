"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2 } from "lucide-react";
import type { Organization } from "@/types";
import type { SubscriptionTier } from "@rampup/supabase";

const PLANS: Record<
  SubscriptionTier,
  { name: string; price: string; features: string[]; highlighted?: boolean }
> = {
  free: {
    name: "Free",
    price: "$0/mo",
    features: [
      "Up to 5 active onboardings",
      "Basic templates",
      "Email notifications",
      "7-day analytics",
    ],
  },
  starter: {
    name: "Starter",
    price: "$49/mo",
    features: [
      "Up to 25 active onboardings",
      "AI-generated plans",
      "Slack integration",
      "30-day analytics",
      "Custom templates",
    ],
  },
  professional: {
    name: "Professional",
    price: "$149/mo",
    highlighted: true,
    features: [
      "Up to 100 active onboardings",
      "All AI features",
      "All integrations",
      "Unlimited analytics",
      "Priority support",
      "Custom branding",
    ],
  },
  enterprise: {
    name: "Enterprise",
    price: "Custom",
    features: [
      "Unlimited onboardings",
      "Dedicated account manager",
      "SSO / SAML",
      "Advanced security",
      "Custom integrations",
      "SLA guarantee",
    ],
  },
};

interface BillingPanelProps {
  organization: Organization;
}

export function BillingPanel({ organization }: BillingPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const currentTier = organization.subscription_tier as SubscriptionTier;

  async function handleUpgrade(tier: string) {
    setLoading(tier);
    try {
      if (tier === "enterprise") {
        window.open("mailto:sales@rampup.app?subject=Enterprise%20Plan%20Inquiry", "_blank");
        return;
      }

      const response = await fetch("/api/webhooks/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_checkout", tier }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(null);
    }
  }

  async function handleManageBilling() {
    setLoading("manage");
    try {
      const response = await fetch("/api/webhooks/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "customer_portal" }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            You are on the <strong>{PLANS[currentTier].name}</strong> plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-lg px-4 py-1">
              {PLANS[currentTier].name}
            </Badge>
            <span className="text-2xl font-bold">{PLANS[currentTier].price}</span>
            {organization.stripe_subscription_id && (
              <Button variant="outline" onClick={handleManageBilling} disabled={loading === "manage"}>
                {loading === "manage" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Manage Billing
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {(Object.entries(PLANS) as [SubscriptionTier, (typeof PLANS)[SubscriptionTier]][]).map(
          ([tier, plan]) => (
            <Card
              key={tier}
              className={`relative ${plan.highlighted ? "border-primary shadow-md" : ""}`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge>Most Popular</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <p className="text-2xl font-bold">{plan.price}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {tier === currentTier ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                    onClick={() => handleUpgrade(tier)}
                    disabled={!!loading}
                  >
                    {loading === tier && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {tier === "enterprise" ? "Contact Sales" : "Upgrade"}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        )}
      </div>
    </div>
  );
}
