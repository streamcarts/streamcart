// Creates a Razorpay order for wallet top-up
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

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
    const amount = Number(body?.amount);
    const purpose = (body?.purpose as string) || "topup";

    if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
      return json({ error: "Invalid amount (must be 1–100000 INR)" }, 400);
    }
    if (!["topup", "checkout"].includes(purpose)) {
      return json({ error: "Invalid purpose" }, 400);
    }

    const keyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    const basicAuth = btoa(`${keyId}:${keySecret}`);

    // Razorpay amount is in paise (integer)
    const amountPaise = Math.round(amount * 100);

    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: `${purpose}_${userId.slice(0, 8)}_${Date.now()}`,
        notes: { user_id: userId, purpose },
      }),
    });

    const rzpData = await rzpRes.json();
    if (!rzpRes.ok) {
      console.error("Razorpay order create failed:", rzpData);
      return json({ error: rzpData?.error?.description || "Razorpay order failed" }, 502);
    }

    // Persist with service role
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error: insErr } = await admin.from("razorpay_orders").insert({
      user_id: userId,
      rzp_order_id: rzpData.id,
      amount,
      currency: "INR",
      purpose,
      status: "created",
      metadata: { receipt: rzpData.receipt },
    });
    if (insErr) {
      console.error("DB insert failed:", insErr);
      return json({ error: "Could not save order" }, 500);
    }

    return json({
      key_id: keyId,
      order_id: rzpData.id,
      amount: amountPaise,
      currency: "INR",
    });
  } catch (e) {
    console.error("create-order error:", e);
    return json({ error: (e as Error).message || "Server error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
