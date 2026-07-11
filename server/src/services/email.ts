const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM ?? 'VoiceGuide <hello@voice-guide.net>';

async function send(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping email to', to);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error('[email] Resend error:', res.status, body);
  }
}

export async function sendUsageAlert(
  email: string,
  used: number,
  limit: number,
  plan: string
): Promise<void> {
  const remaining = limit - used;
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);

  await send(
    email,
    `You have ${remaining} video${remaining === 1 ? '' : 's'} left this month`,
    `
    <div style="font-family:system-ui,sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;background:#0d0d1a;color:#fff;border-radius:12px;">
      <p style="font-size:28px;font-weight:700;margin:0 0 8px;">You've used ${used}/${limit} videos this month.</p>
      <p style="color:rgba(255,255,255,0.55);font-size:15px;margin:0 0 28px;">
        You're on the ${planLabel} plan and have <strong style="color:#fff;">${remaining} video${remaining === 1 ? '' : 's'} remaining</strong> this month.
        When it runs out, new recordings will be blocked until you upgrade.
      </p>
      <a href="${process.env.FRONTEND_URL}/pricing"
        style="display:inline-block;background:linear-gradient(135deg,rgba(0,212,255,0.9),rgba(180,77,255,0.8));color:#fff;font-weight:600;font-size:15px;padding:14px 28px;border-radius:10px;text-decoration:none;">
        Upgrade now →
      </a>
      <p style="color:rgba(255,255,255,0.25);font-size:12px;margin-top:32px;">
        You're receiving this because you use VoiceGuide. <a href="${process.env.FRONTEND_URL}/settings" style="color:rgba(255,255,255,0.4);">Manage account</a>
      </p>
    </div>
    `
  );
}
