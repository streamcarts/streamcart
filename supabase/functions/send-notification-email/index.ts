// Sends an email via Resend (through the Lovable connector gateway)
// for a notification row. Invoked by a database trigger via pg_net.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const payload = await req.json();
    // Accept either { notification_id } or a pg_net webhook { record: {...} }
    const notifId: string | undefined = payload.notification_id ?? payload.record?.id;
    if (!notifId) throw new Error("notification_id missing");

    const { data: notif, error: nErr } = await admin
      .from("notifications")
      .select("id,user_id,type,title,body,link,push_sent")
      .eq("id", notifId)
      .maybeSingle();
    if (nErr || !notif) throw new Error(nErr?.message ?? "notification not found");
    if (notif.push_sent) return json({ skipped: "already_sent" });

    // Look up user email via auth.admin
    const { data: userRes, error: uErr } = await admin.auth.admin.getUserById(notif.user_id);
    if (uErr || !userRes?.user?.email) throw new Error("user email not found");
    const toEmail = userRes.user.email;

    const link = notif.link
      ? `https://streamcart.lovable.app${notif.link.startsWith("/") ? notif.link : "/" + notif.link}`
      : "https://streamcart.lovable.app";

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;color:#0f172a">
        <div style="font-size:13px;color:#64748b;margin-bottom:8px">StreamCart</div>
        <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(notif.title)}</h1>
        ${notif.body ? `<p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 20px">${escapeHtml(notif.body)}</p>` : ""}
        <a href="${link}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500">Open StreamCart</a>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0 12px"/>
        <div style="font-size:11px;color:#94a3b8">You're receiving this because of activity on your StreamCart account.</div>
      </div>`;

    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "StreamCart <onboarding@resend.dev>",
        to: [toEmail],
        subject: notif.title,
        html,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(`Resend error [${res.status}]: ${JSON.stringify(data)}`);

    await admin.from("notifications").update({ push_sent: true }).eq("id", notif.id);
    return json({ ok: true, id: data.id });
  } catch (e) {
    console.error("send-notification-email error:", e);
    return json({ ok: false, error: e instanceof Error ? e.message : "unknown" }, 500);
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
