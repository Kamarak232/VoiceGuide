import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { stripe, PRICE_TO_PLAN } from '../services/stripe';
import { supabase } from '../services/supabase';
import { PLAN_LIMITS } from '../services/limits';
import { AuthRequest } from '../middleware/auth';

const router = Router();

const PLAN_PRICE: Record<string, string | undefined> = {
  creator: process.env.STRIPE_PRICE_CREATOR,
  pro: process.env.STRIPE_PRICE_PRO,
  studio: process.env.STRIPE_PRICE_STUDIO,
};

// GET /billing/status — current plan + usage
router.get('/status', async (req: AuthRequest, res: Response) => {
  const { data: user } = await supabase
    .from('vg_users')
    .select('plan, stripe_customer_id')
    .eq('id', req.userId!)
    .single();

  const plan = (user?.plan as string) ?? 'free';
  const limit = PLAN_LIMITS[plan] ?? 3;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('vg_videos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.userId!)
    .gte('created_at', startOfMonth.toISOString());

  res.json({
    plan,
    used: count ?? 0,
    limit,
    hasStripe: !!user?.stripe_customer_id,
  });
});

// POST /billing/checkout — create Stripe Checkout session
router.post('/checkout', async (req: AuthRequest, res: Response) => {
  const { plan } = req.body as { plan: string };
  const priceId = PLAN_PRICE[plan];

  if (!priceId) {
    res.status(400).json({ error: 'Invalid plan.' });
    return;
  }

  const { data: user } = await supabase
    .from('vg_users')
    .select('stripe_customer_id')
    .eq('id', req.userId!)
    .single();

  let customerId = user?.stripe_customer_id as string | undefined;
  try {
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.userEmail,
        metadata: { supabase_user_id: req.userId! },
      });
      customerId = customer.id;
      await supabase.from('vg_users').update({ stripe_customer_id: customerId }).eq('id', req.userId!);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/record?upgraded=1`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      client_reference_id: req.userId,
      subscription_data: {
        metadata: { supabase_user_id: req.userId! },
      },
    });

    res.json({ url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe error';
    res.status(500).json({ error: msg });
  }
});

// POST /billing/portal — Stripe customer portal
router.post('/portal', async (req: AuthRequest, res: Response) => {
  const { data: user } = await supabase
    .from('vg_users')
    .select('stripe_customer_id')
    .eq('id', req.userId!)
    .single();

  if (!user?.stripe_customer_id) {
    res.status(404).json({ error: 'No billing account found.' });
    return;
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id as string,
      return_url: `${process.env.FRONTEND_URL}/record`,
    });
    res.json({ url: session.url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe error';
    res.status(500).json({ error: msg });
  }
});

// POST /billing/webhook — Stripe events (raw body required — registered before express.json in index.ts)
export async function webhookHandler(req: Request, res: Response) {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(400).send(`Webhook Error: ${msg}`);
    return;
  }

  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated'
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const priceId = sub.items.data[0]?.price.id ?? '';
    const plan = PRICE_TO_PLAN[priceId] ?? 'free';
    const userId = sub.metadata?.supabase_user_id;
    if (userId) {
      await supabase.from('vg_users').update({ plan }).eq('id', userId);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.supabase_user_id;
    if (userId) {
      await supabase.from('vg_users').update({ plan: 'free' }).eq('id', userId);
    }
  }

  res.json({ received: true });
}

export default router;
