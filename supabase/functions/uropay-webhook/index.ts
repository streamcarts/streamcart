// UroPay webhook receiver - HMAC-SHA256 verified
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

async function sha512Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-512", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(keyStr: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(keyStr),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const SECRET = Deno.env.get("UROPAY_SECRET");
    if (!SECRET) throw new Error("UROPAY_SECRET not configured");

    const env = req.headers.get("X-Uropay-Environment") || "PRODUCTION";
    const sigHeader = req.headers.get("X-Uropay-Signature") || "";

    const raw = await req.text();
    const data = JSON.parse(raw);

    // Verify signature: HMAC-SHA256( sha512(secret), JSON.stringify(sortedData + environment) )
    const sorted: Record<string, unknown> = {};
    Object.keys(data).sort().forEach(k => { sorted[k] = data[k]; });
    const payloadStr = JSON.stringify({ ...sorted, environment: env });

    const hashedSecret = await sha512Hex(SECRET);
    const expectedSig = await hmacSha256Hex(hashedSecret, payloadStr);

    if (sigHeader.toLowerCase() !== expectedSig.toLowerCase()) {
      console.error("Signature mismatch", { got: sigHeader, expected: expectedSig });
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const referenceNumber: string | undefined = data.referenceNumber;
    const amountStr: string | undefined = data.amount;
    if (!referenceNumber) {
      return new Response(JSON.stringify({ ok: true, ignored: "no reference" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Find matching order by reference
    const { data: row } = await admin
      .from("uropay_orders")
      .select("*")
      .eq("reference_number", referenceNumber)
      .maybeSingle();

    if (!row) {
      // No order yet — could be the SMS-first webhook. Just record nothing for now.
      console.log("Webhook received for unknown reference", referenceNumber);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const webhookAmt = amountStr ? Number(amountStr) : null;
    await admin.from("uropay_orders").update({
      webhook_amount: webhookAmt,
      webhook_received_at: new Date().toISOString(),
      status: row.status === "completed" ? "completed" : "paid",
    }).eq("id", row.id);

    // Verify amount matches before completing
    if (row.status !== "completed" && webhookAmt !== null && Math.abs(webhookAmt - Number(row.amount)) < 0.01) {
      if (row.purpose === "topup") {
        await admin.rpc("complete_uropay_topup", { _uropay_order_id: row.uropay_order_id });
      } else {
        await admin.rpc("complete_uropay_checkout", { _uropay_order_id: row.uropay_order_id });
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("uropay-webhook error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
