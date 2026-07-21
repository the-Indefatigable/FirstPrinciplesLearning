/**
 * Vercel serverless function — sends booking emails via Resend.
 *
 * Env vars (set in Vercel → Settings → Environment Variables):
 *   RESEND_API_KEY        (required) — your Resend API key
 *   BOOKING_NOTIFY_EMAIL  (optional) — where YOU get "new booking" alerts
 *                                      (defaults to firstprincipletutoringg@gmail.com)
 *   BOOKING_FROM_EMAIL    (optional) — verified sender; defaults to Resend's test sender
 *                                      until your domain is verified in Resend.
 *
 * Called by the booking widget right after a booking is saved. Fire-and-forget:
 * if email fails, the booking is already stored, so the student still succeeds.
 */

type VercelReq = { method?: string; body?: unknown };
type VercelRes = {
    status: (code: number) => VercelRes;
    json: (data: unknown) => void;
};

interface BookingPayload {
    name?: string;
    email?: string;
    subject?: string;
    whenText?: string;
    durationMin?: number;
    notes?: string;
}

// ── Brand tokens (mirrors the site's warm academic palette) ──
const BRAND = {
    site: 'https://www.firstprincipleslearningg.com',
    name: 'FirstPrinciple Tutoring',
    tagline: 'Where tough subjects click.',
    amber: '#d97706',
    amberDark: '#b45309',
    ink: '#1a1612',
    body: '#423d35',
    dim: '#7a7268',
    warm: '#faf8f5',
    card: '#ffffff',
    accent: '#fdf6ec',
    border: '#ece3d6',
    sage: '#6b8f71',
};

// Hosted images (served from public/ on the production domain).
const IMG = {
    logo: 'https://www.firstprincipleslearningg.com/favicon-192.png',
    banner: 'https://www.firstprincipleslearningg.com/og-image.png',
};

const esc = (s: unknown) =>
    String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function sendEmail(apiKey: string, payload: Record<string, unknown>) {
    const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
    return r.json();
}

function subjectEmoji(subject: string): string {
    const k = subject.toLowerCase();
    if (k.includes('math')) return '📐';
    if (k.includes('phys')) return '🔭';
    if (k.includes('comp') || k.includes('cs')) return '💻';
    return '📘';
}

/** Booking summary card used in both emails. */
function summaryCard(subject: string, whenText: string, durationMin?: number, notes?: string) {
    const row = (k: string, v: string, last = false) => `
        <tr>
            <td style="padding:12px 20px;${last ? '' : `border-bottom:1px solid ${BRAND.border};`}color:${BRAND.dim};font-size:13px;font-family:Arial,Helvetica,sans-serif;white-space:nowrap;">${k}</td>
            <td style="padding:12px 20px;${last ? '' : `border-bottom:1px solid ${BRAND.border};`}color:${BRAND.ink};font-size:14px;font-weight:700;font-family:Arial,Helvetica,sans-serif;text-align:right;">${v}</td>
        </tr>`;
    return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.accent};border:1px solid ${BRAND.border};border-radius:14px;margin:8px 0 4px;">
        ${row('Subject', `${subjectEmoji(subject)}&nbsp; ${esc(subject)}`)}
        ${row('When', esc(whenText))}
        ${row('Length', `${durationMin ?? 60} minutes · Free`, !notes)}
        ${notes ? row('Focus', esc(notes), true) : ''}
    </table>`;
}

/** Shared responsive shell: warm background, white card, branded header + footer. */
function shell(preheader: string, inner: string) {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${esc(BRAND.name)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.warm};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.warm};padding:32px 12px;">
    <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(26,22,18,0.06);">
            <!-- Header -->
            <tr><td style="padding:26px 32px 20px;border-bottom:1px solid ${BRAND.border};">
                <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td style="vertical-align:middle;"><img src="${IMG.logo}" width="40" height="40" alt="FirstPrinciple" style="display:block;border-radius:10px;"></td>
                    <td style="padding-left:12px;font-family:Georgia,'Times New Roman',serif;font-size:19px;color:${BRAND.ink};font-weight:400;vertical-align:middle;">FirstPrinciple<span style="color:${BRAND.amber};"> Tutoring</span></td>
                </tr></table>
            </td></tr>
            <!-- Body -->
            <tr><td style="padding:34px 32px 28px;">${inner}</td></tr>
            <!-- Footer -->
            <tr><td style="padding:22px 32px 30px;border-top:1px solid ${BRAND.border};background:${BRAND.warm};">
                <p style="margin:0 0 6px;font-family:Georgia,serif;font-style:italic;color:${BRAND.dim};font-size:14px;">${esc(BRAND.tagline)}</p>
                <p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:${BRAND.dim};font-size:12px;line-height:1.6;">
                    1-on-1 tutoring in Math, Physics &amp; Computer Science · Based in Canada 🇨🇦<br>
                    <a href="${BRAND.site}" style="color:${BRAND.amber};text-decoration:none;">firstprincipleslearningg.com</a>
                </p>
            </td></tr>
        </table>
        <p style="font-family:Arial,Helvetica,sans-serif;color:#b3a99c;font-size:11px;margin:18px 0 0;">© 2026 FirstPrinciple Tutoring</p>
    </td></tr>
</table>
</body>
</html>`;
}

/** Bulletproof CTA button. */
function button(label: string, href: string) {
    return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0;"><tr>
        <td style="background:${BRAND.amber};border-radius:10px;">
            <a href="${href}" style="display:inline-block;padding:13px 30px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${label}</a>
        </td>
    </tr></table>`;
}

function studentHtml(firstName: string, subject: string, whenText: string, durationMin?: number, notes?: string) {
    const p = (t: string) => `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${BRAND.body};">${t}</p>`;
    const step = (n: string, t: string) => `
        <tr>
            <td style="width:26px;vertical-align:top;padding:4px 0;"><span style="display:inline-block;width:22px;height:22px;background:${BRAND.accent};border:1px solid ${BRAND.border};border-radius:50%;color:${BRAND.amber};font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;text-align:center;line-height:22px;">${n}</span></td>
            <td style="padding:4px 0 4px 10px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${BRAND.body};">${t}</td>
        </tr>`;
    return shell(
        `You're booked, ${firstName}! Here are your session details.`,
        `
        <a href="${BRAND.site}" style="text-decoration:none;"><img src="${IMG.banner}" alt="FirstPrinciple Learning — Interactive Math, Physics & CS" width="536" style="display:block;width:100%;max-width:536px;height:auto;border-radius:14px;margin:0 0 24px;"></a>
        <h1 style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:27px;line-height:1.2;color:${BRAND.ink};">
            You're all set, ${firstName}. <span style="color:${BRAND.amber};">🎉</span>
        </h1>
        ${p(`Thanks for booking a <strong>free consultation</strong> with FirstPrinciple Tutoring — I'm looking forward to meeting you. Here's everything you need:`)}
        ${summaryCard(subject, whenText, durationMin, notes)}
        <h2 style="margin:26px 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:${BRAND.dim};">What happens next</h2>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            ${step('1', `I'll email you shortly to <strong>confirm the time</strong> and send your private meeting link.`)}
            ${step('2', `Come with <strong>anything you're stuck on</strong> — a topic, a homework problem, an upcoming test. No prep needed.`)}
            ${step('3', `We'll work through it from first principles, so it actually <em>clicks</em> — not just memorized.`)}
        </table>
        <div style="height:26px;"></div>
        ${p(`<strong>While you wait</strong>, explore the same interactive tools we'll use in your sessions — drag, tweak, and see the concepts move:`)}
        ${button('Explore the interactive tools →', BRAND.site + '/math')}
        <div style="height:22px;"></div>
        ${p(`Need to reschedule or change anything? Just <strong>reply to this email</strong> — it comes straight to me.`)}
        <p style="margin:22px 0 0;font-family:Georgia,serif;font-size:15px;color:${BRAND.ink};">See you soon,<br><span style="color:${BRAND.amber};font-style:italic;">The FirstPrinciple team</span></p>
        `,
    );
}

function tutorHtml(name: string, email: string, subject: string, whenText: string, durationMin?: number, notes?: string) {
    return shell(
        `New booking from ${name} — ${subject}, ${whenText}`,
        `
        <h1 style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:26px;line-height:1.2;color:${BRAND.ink};">
            New session booked <span style="color:${BRAND.amber};">🎓</span>
        </h1>
        <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:${BRAND.body};">
            <strong>${esc(name)}</strong> just booked a free consultation.
        </p>
        ${summaryCard(subject, whenText, durationMin, notes)}
        <div style="height:18px;"></div>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="background:${BRAND.sage};border-radius:10px;">
                <a href="mailto:${esc(email)}" style="display:inline-block;padding:12px 26px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Reply to ${esc(String(name).split(' ')[0])} →</a>
            </td>
        </tr></table>
        <p style="margin:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND.dim};">
            Student email: <a href="mailto:${esc(email)}" style="color:${BRAND.amber};text-decoration:none;">${esc(email)}</a><br>
            (Replying to this alert reaches them directly.)
        </p>
        `,
    );
}

export default async function handler(req: VercelReq, res: VercelRes) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const key = process.env.RESEND_API_KEY;
    if (!key) {
        res.status(500).json({ error: 'RESEND_API_KEY not configured' });
        return;
    }

    const from = process.env.BOOKING_FROM_EMAIL || 'FirstPrinciple Tutoring <onboarding@resend.dev>';
    const notify = process.env.BOOKING_NOTIFY_EMAIL || 'firstprincipletutoringg@gmail.com';

    const body: BookingPayload =
        typeof req.body === 'string' ? JSON.parse(req.body || '{}') : ((req.body as BookingPayload) || {});
    const { name, email, subject, whenText, durationMin, notes } = body;

    if (!name || !email || !subject || !whenText) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
    }

    const firstName = esc(String(name).split(' ')[0]);
    const results: Record<string, string> = {};

    // 1) Notify the tutor
    try {
        await sendEmail(key, {
            from,
            to: [notify],
            reply_to: email,
            subject: `🎓 New booking: ${name} — ${subject} (${whenText})`,
            html: tutorHtml(String(name), String(email), String(subject), String(whenText), durationMin, notes),
        });
        results.tutor = 'sent';
    } catch (e) {
        results.tutor = 'failed: ' + (e as Error).message;
    }

    // 2) Confirm the student
    try {
        await sendEmail(key, {
            from,
            to: [email],
            reply_to: notify,
            subject: `You're booked! Your free ${subject} session ✓`,
            html: studentHtml(firstName, String(subject), String(whenText), durationMin, notes),
        });
        results.student = 'sent';
    } catch (e) {
        results.student = 'failed: ' + (e as Error).message;
    }

    res.status(200).json({ ok: true, results });
}
