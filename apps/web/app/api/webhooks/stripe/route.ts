import { NextRequest, NextResponse } from "next/server";
import { stripe, createCheckoutSession, createCustomerPortalSession, getOrCreateCustomer } from "@/lib/stripe";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { SubscriptionTier } from "@rampup/supabase";

const tierLimits: Record<string, { tier: SubscriptionTier; maxOnboardings: number }> = {
  starter: { tier: "starter", maxOnboardings: 25 },
  professional: { tier: "professional", maxOnboardings: 100 },
  enterprise: { tier: "enterprise", maxOnboardings: 999999 },
};

// Handle Stripe webhook events
export async function POST(request: NextRequest) {
  const body = await request.text();
  const contentType = request.headers.get("content-type");

  // Check if this is a webhook from Stripe or an API call from our frontend
  if (contentType === "application/json" && !request.headers.get("stripe-signature")) {
    // Frontend API call
    return handleFrontendRequest(JSON.parse(body));
  }

  // Stripe webhook
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const adminSupabase = await createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      // Get subscription to determine the tier
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0]?.price?.id;

      let newTier: SubscriptionTier = "starter";
      let maxOnboardings = 25;

      if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
        newTier = "professional";
        maxOnboardings = 100;
      } else if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) {
        newTier = "enterprise";
        maxOnboardings = 999999;
      }

      await adminSupabase
        .from("organizations")
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_tier: newTier,
          max_active_onboardings: maxOnboardings,
        })
        .eq("stripe_customer_id", customerId);

      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const customerId = subscription.customer as string;
      const status = subscription.status;

      if (status === "active") {
        const priceId = subscription.items.data[0]?.price?.id;
        let newTier: SubscriptionTier = "starter";
        let maxOnboardings = 25;

        if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
          newTier = "professional";
          maxOnboardings = 100;
        } else if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) {
          newTier = "enterprise";
          maxOnboardings = 999999;
        }

        await adminSupabase
          .from("organizations")
          .update({
            subscription_tier: newTier,
            max_active_onboardings: maxOnboardings,
          })
          .eq("stripe_customer_id", customerId);
      }

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId = subscription.customer as string;

      await adminSupabase
        .from("organizations")
        .update({
          subscription_tier: "free",
          max_active_onboardings: 5,
          stripe_subscription_id: null,
        })
        .eq("stripe_customer_id", customerId);

      break;
    }
  }

  return NextResponse.json({ received: true });
}

async function handleFrontendRequest(body: { action: string; tier?: string }) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from("users")
      .select("organization_id, role, email, full_name")
      .eq("id", authUser.id)
      .single();

    if (!currentUser || currentUser.role !== "owner") {
      return NextResponse.json({ error: "Only organization owners can manage billing" }, { status: 403 });
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", currentUser.organization_id)
      .single();

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (body.action === "create_checkout" && body.tier) {
      const tierConfig = tierLimits[body.tier];
      if (!tierConfig) {
        return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
      }

      const customer = await getOrCreateCustomer(
        currentUser.email,
        currentUser.full_name,
        org.id
      );

      // Update org with Stripe customer ID if not set
      if (!org.stripe_customer_id) {
        await supabase
          .from("organizations")
          .update({ stripe_customer_id: customer.id })
          .eq("id", org.id);
      }

      const priceId = body.tier === "professional"
        ? process.env.STRIPE_PRO_PRICE_ID
        : process.env.STRIPE_STARTER_PRICE_ID;

      if (!priceId) {
        return NextResponse.json({ error: "Price not configured" }, { status: 500 });
      }

      const session = await createCheckoutSession(
        customer.id,
        priceId,
        `${appUrl}/settings?tab=billing&success=true`,
        `${appUrl}/settings?tab=billing&cancelled=true`
      );

      return NextResponse.json({ url: session.url });
    }

    if (body.action === "customer_portal") {
      if (!org.stripe_customer_id) {
        return NextResponse.json({ error: "No billing account found" }, { status: 400 });
      }

      const session = await createCustomerPortalSession(
        org.stripe_customer_id,
        `${appUrl}/settings?tab=billing`
      );

      return NextResponse.json({ url: session.url });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
