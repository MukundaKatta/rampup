import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
});

export const PLANS = {
  free: {
    name: "Free",
    maxOnboardings: 5,
    price: 0,
    features: [
      "Up to 5 active onboardings",
      "Basic templates",
      "Email notifications",
      "7-day analytics",
    ],
  },
  starter: {
    name: "Starter",
    maxOnboardings: 25,
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    price: 49,
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
    maxOnboardings: 100,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    price: 149,
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
    maxOnboardings: -1, // unlimited
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    price: -1, // custom
    features: [
      "Unlimited onboardings",
      "Dedicated account manager",
      "SSO / SAML",
      "Advanced security",
      "Custom integrations",
      "SLA guarantee",
    ],
  },
} as const;

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
) {
  return stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      trial_period_days: 14,
    },
  });
}

export async function createCustomerPortalSession(customerId: string, returnUrl: string) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

export async function getOrCreateCustomer(email: string, name: string, orgId: string) {
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length > 0) {
    return existing.data[0];
  }

  return stripe.customers.create({
    email,
    name,
    metadata: { organization_id: orgId },
  });
}
