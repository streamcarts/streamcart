import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-urpay-signature",
};

async function hmacSHA256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const raw = await req.text();
    const signature = req.headers.get("x-urpay-signature") || "";
    const secret = Deno.env.get("URPAY_WEBHOOK_SECRET");

    if (secret) {
      const expected = await hmacSHA256Hex(secret, raw);
      if (expected !== signature) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const event = JSON.parse(raw);
    // Accept common UrPay shapes
    const status = (event.status || event.event || event.data?.status || "").toString().toLowerCase();
    const ourId = event.order_id || event.data?.order_id || event.metadata?.order_id;
    const providerPaymentId = event.payment_id || event.data?.payment_id || event.id || "";

    if (!ourId) {
      return new Response(JSON.stringify({ error: "Missing order_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (status.includes("success") || status.includes("paid") || status === "captured" || status === "completed") {
      const { error } = await admin.rpc("urpay_mark_paid", { _intent_id: ourId, _provider_payment_id: providerPaymentId });
      if (error) throw new Error(error.message);
    } else if (status.includes("fail") || status.includes("cancel") || status === "expired") {
      await admin.from("payment_intents").update({ status: status.includes("expired") ? "expired" : "failed", updated_at: new Date().toISOString() }).eq("id", ourId);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
