// Verifies Razorpay payment signature, then credits wallet (top-up)
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body ?? {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ error: "Missing fields" }, 400);
    }

    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;

    // Compute HMAC SHA256 of `${order_id}|${payment_id}` with key_secret
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(keySecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      enc.encode(`${razorpay_order_id}|${razorpay_payment_id}`),
    );
    const computed = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (computed !== razorpay_signature) {
      console.warn("Signature mismatch", { computed, given: razorpay_signature });
      return json({ error: "Invalid signature" }, 400);
    }

    // Use service role to update + credit
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Confirm row belongs to this user and not already verified
    const { data: row, error: rowErr } = await admin
      .from("razorpay_orders")
      .select("user_id, status, purpose, amount")
      .eq("rzp_order_id", razorpay_order_id)
      .maybeSingle();
    if (rowErr || !row) return json({ error: "Order not found" }, 404);
    if (row.user_id !== userId) return json({ error: "Forbidden" }, 403);

    if (row.status === "verified") {
      return json({ ok: true, already_verified: true });
    }

    // Mark paid + signature stored
    await admin
      .from("razorpay_orders")
      .update({
        rzp_payment_id: String(razorpay_payment_id),
        rzp_signature: String(razorpay_signature),
        status: "paid",
      })
      .eq("rzp_order_id", razorpay_order_id);

    if (row.purpose === "topup") {
      const { error: rpcErr } = await admin.rpc("complete_razorpay_topup", {
        _rzp_order_id: razorpay_order_id,
      });
      if (rpcErr) {
        console.error("complete_razorpay_topup failed:", rpcErr);
        return json({ error: rpcErr.message }, 500);
      }
    }

    return json({ ok: true, amount: row.amount });
  } catch (e) {
    console.error("verify error:", e);
    return json({ error: (e as Error).message || "Server error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
