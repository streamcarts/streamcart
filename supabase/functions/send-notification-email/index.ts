// Sends an email via Resend (through the Lovable connector gateway)
// for a notification row. Invoked by a database trigger via pg_net.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const SITE_URL = "https://streamcart.lovable.app";
const BRAND = "StreamCart";
const SUPPORT_EMAIL = "support.streamcart@gmail.com";

// Per-event subject + CTA mapping. Falls back to notification.title when type is unknown.
type Mapping = { subject: string; cta: string; tagline?: string };
const TYPE_MAP: Record<string, Mapping> = {
  // Buyer
  order_placed: { subject: "Order Confirmed 🎉", cta: "View Order", tagline: "Your payment is being verified. We'll update you shortly." },
  payment_approved: { subject: "Payment Verified ✅", cta: "View Order", tagline: "Your payment was approved. Seller will deliver your access soon." },
  credentials_delivered: { subject: "Your Access is Ready 🔐", cta: "View Order", tagline: "Login details are available in your dashboard." },
  refund_processed: { subject: "Refund Processed 💸", cta: "View Order", tagline: "Your refund has been processed successfully." },
  // Seller
  order_new: { subject: "New Order Received 💰", cta: "View Order", tagline: "A buyer just placed an order. Please deliver access promptly." },
  chat_message: { subject: "New Message 💬", cta: "Open Chat", tagline: "You have a new message on StreamCart." },
  // Admin
  payment_pending: { subject: "Payment Needs Approval ⚠️", cta: "Review Payment", tagline: "A new payment is awaiting your approval." },
  complaint_new: { subject: "New Complaint 🚨", cta: "Review Complaint", tagline: "A buyer has filed a new complaint." },
};

// Reusable email sender with retries (max 3 attempts = 1 + 2 retries)
async function sendEmailOnce(opts: { to: string; subject: string; html: string }) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? `${BRAND} <onboarding@resend.dev>`;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [opts.to], subject: opts.subject, html: opts.html }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend error [${res.status}]: ${JSON.stringify(data)}`);
  return data as { id?: string };
}

async function sendEmailWithRetry(
  admin: ReturnType<typeof createClient>,
  opts: { to: string; subject: string; html: string; type: string | null; notificationId: string },
) {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await sendEmailOnce(opts);
      await admin.from("email_logs").insert({
        notification_id: opts.notificationId,
        recipient: opts.to,
        subject: opts.subject,
        type: opts.type,
        status: "sent",
        attempt,
        provider_id: result.id ?? null,
      });
      return result;
    } catch (e) {
      lastErr = e;
      const errMsg = e instanceof Error ? e.message : String(e);
      const isFinal = attempt === 3;
      await admin.from("email_logs").insert({
        notification_id: opts.notificationId,
        recipient: opts.to,
        subject: opts.subject,
        type: opts.type,
        status: isFinal ? "failed" : "retry",
        attempt,
        error: errMsg.slice(0, 500),
      });
      if (!isFinal) await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  throw lastErr;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const payload = await req.json();
    const notifId: string | undefined = payload.notification_id ?? payload.record?.id;
    if (!notifId) throw new Error("notification_id missing");

    const { data: notif, error: nErr } = await admin
      .from("notifications")
      .select("id,user_id,type,title,body,link,push_sent")
      .eq("id", notifId)
      .maybeSingle();
    if (nErr || !notif) throw new Error(nErr?.message ?? "notification not found");
    if (notif.push_sent) return json({ skipped: "already_sent" });

    const { data: userRes, error: uErr } = await admin.auth.admin.getUserById(notif.user_id);
    if (uErr || !userRes?.user?.email) throw new Error("user email not found");
    const toEmail = userRes.user.email;

    const link = notif.link
      ? `${SITE_URL}${notif.link.startsWith("/") ? notif.link : "/" + notif.link}`
      : `${SITE_URL}/orders`;

    const map = TYPE_MAP[notif.type ?? ""] ?? { subject: notif.title, cta: "View Order" };
    const subject = map.subject;
    // Strip any sensitive content from body just in case (no creds in email)
    const safeBody = sanitizeBody(notif.body ?? map.tagline ?? "");

    const html = renderTemplate({
      title: notif.title || subject,
      body: safeBody,
      ctaLabel: map.cta,
      ctaUrl: link,
    });

    // Mark sent FIRST (atomic dedup) — re-invocations skip via push_sent guard above.
    await admin.from("notifications").update({ push_sent: true }).eq("id", notif.id);

    try {
      const result = await sendEmailWithRetry(admin, {
        to: toEmail,
        subject,
        html,
        type: notif.type ?? null,
        notificationId: notif.id,
      });
      return json({ ok: true, id: result.id });
    } catch (sendErr) {
      // Email failure must not break the system flow — already logged in email_logs.
      console.error("Email send failed after retries (non-fatal):", sendErr);
      return json({ ok: false, error: sendErr instanceof Error ? sendErr.message : "send_failed" }, 200);
    }
  } catch (e) {
    console.error("send-notification-email error:", e);
    return json({ ok: false, error: e instanceof Error ? e.message : "unknown" }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// Strip anything that looks like credentials so we never email login info
function sanitizeBody(s: string): string {
  let out = s;
  out = out.replace(/(password|pwd|pass)\s*[:=]\s*\S+/gi, "");
  out = out.replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\s*[/|]\s*\S+/g, ""); // email/password pairs
  return out.trim();
}

function renderTemplate(o: { title: string; body: string; ctaLabel: string; ctaUrl: string }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:Inter,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.06)">
        <tr><td style="padding:24px 28px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff">
          <div style="font-size:18px;font-weight:700;letter-spacing:-0.01em">${BRAND}</div>
          <div style="font-size:12px;opacity:0.85;margin-top:2px">Trusted marketplace for digital subscriptions</div>
        </td></tr>
        <tr><td style="padding:28px">
          <h1 style="font-size:20px;line-height:1.3;margin:0 0 12px;color:#0f172a">${escapeHtml(o.title)}</h1>
          ${o.body ? `<p style="font-size:14px;line-height:1.65;color:#334155;margin:0 0 24px">${escapeHtml(o.body)}</p>` : ""}
          <a href="${o.ctaUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:600">${escapeHtml(o.ctaLabel)}</a>
          <p style="font-size:12px;color:#64748b;margin:24px 0 0">For your security, we never include passwords or login credentials in emails. Always view them in your dashboard.</p>
        </td></tr>
        <tr><td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">
          Need help? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#6366f1;text-decoration:none">${SUPPORT_EMAIL}</a>.
          <br/>© ${new Date().getFullYear()} ${BRAND}. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
