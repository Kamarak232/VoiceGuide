import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required.');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-06-24.dahlia',
});

export const PRICE_TO_PLAN: Record<string, string> = {
  [process.env.STRIPE_PRICE_CREATOR ?? '']: 'creator',
  [process.env.STRIPE_PRICE_PRO ?? '']: 'pro',
  [process.env.STRIPE_PRICE_STUDIO ?? '']: 'studio',
};
