import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const URPAY_API_KEY = Deno.env.get("URPAY_API_KEY");
    if (!URPAY_API_KEY) throw new Error("URPAY_API_KEY missing");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: uerr } = await anon.auth.getUser();
    if (uerr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email ?? "";

    const body = await req.json().catch(() => ({}));
    const purpose = body.purpose === "checkout" ? "checkout" : "topup";
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const metadata = typeof body.metadata === "object" && body.metadata ? body.metadata : {};

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Create local intent first so we know the ID for webhook reconciliation
    const { data: intent, error: ierr } = await admin
      .from("payment_intents")
      .insert({ user_id: userId, purpose, amount, metadata, status: "pending", provider: "urpay" })
      .select()
      .single();
    if (ierr || !intent) throw new Error(ierr?.message || "Intent create failed");

    const origin = req.headers.get("origin") || "https://streamcart.lovable.app";
    const callbackUrl = `${supabaseUrl}/functions/v1/urpay-webhook`;
    const redirectUrl = `${origin}/payment-return?intent=${intent.id}`;

    // Call UrPay create-order endpoint
    const upRes = await fetch("https://api.urpay.in/v1/orders/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${URPAY_API_KEY}`,
      },
      body: JSON.stringify({
        amount,
        currency: "INR",
        order_id: intent.id,
        customer_email: userEmail,
        customer_name: userEmail.split("@")[0],
        description: purpose === "topup" ? "Wallet Top-Up" : "Order Payment",
        callback_url: callbackUrl,
        redirect_url: redirectUrl,
      }),
    });

    const upJson: any = await upRes.json().catch(() => ({}));
    if (!upRes.ok) {
      await admin.from("payment_intents").update({ status: "failed", metadata: { ...metadata, urpay_error: upJson } }).eq("id", intent.id);
      return new Response(JSON.stringify({ error: "UrPay create failed", details: upJson }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const paymentUrl = upJson.payment_url || upJson.checkout_url || upJson.data?.payment_url;
    const providerOrderId = upJson.order_id || upJson.id || upJson.data?.order_id;

    await admin.from("payment_intents").update({
      payment_url: paymentUrl,
      provider_order_id: providerOrderId,
      metadata: { ...metadata, urpay_raw: upJson },
    }).eq("id", intent.id);

    return new Response(JSON.stringify({ intent_id: intent.id, payment_url: paymentUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
