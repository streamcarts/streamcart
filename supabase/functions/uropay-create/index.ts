// UroPay create order - generates QR for checkout or wallet topup
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UROPAY_URL = "https://api.uropay.me";

async function sha512Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-512", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const API_KEY = Deno.env.get("UROPAY_API_KEY");
    const SECRET = Deno.env.get("UROPAY_SECRET");
    const DEFAULT_VPA = Deno.env.get("UROPAY_DEFAULT_VPA") || "";
    if (!API_KEY || !SECRET) throw new Error("UroPay credentials not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims, error: cErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (cErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId: string = claims.claims.sub;
    const userEmail: string = claims.claims.email || "buyer@streamcart.app";

    const body = await req.json();
    const purpose: "checkout" | "topup" = body.purpose;
    const amount: number = Number(body.amount); // rupees
    const items = body.items ?? null;
    const couponCode: string | null = body.coupon_code ?? null;
    const affiliateSlug: string | null = body.affiliate_slug ?? null;
    const customerName: string = (body.customer_name || "Customer").toString().slice(0, 80);

    if (!["checkout", "topup"].includes(purpose)) throw new Error("Invalid purpose");
    if (!Number.isFinite(amount) || amount < 1) throw new Error("Invalid amount");
    if (purpose === "checkout" && (!Array.isArray(items) || items.length === 0)) throw new Error("Items required for checkout");

    const merchantOrderId = `${purpose === "topup" ? "TOP" : "ORD"}-${userId.slice(0, 8)}-${Date.now()}`;
    const amountPaise = Math.round(amount * 100);

    const hashedSecret = await sha512Hex(SECRET);

    const upPayload: Record<string, unknown> = {
      amount: amountPaise,
      merchantOrderId,
      customerName,
      customerEmail: userEmail,
      transactionNote: purpose === "topup" ? `Wallet topup ${merchantOrderId}` : `Order ${merchantOrderId}`,
      notes: { purpose, user_id: userId },
    };
    if (DEFAULT_VPA) upPayload.vpa = DEFAULT_VPA;

    const upRes = await fetch(`${UROPAY_URL}/order/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-API-KEY": API_KEY,
        "Authorization": `Bearer ${hashedSecret}`,
      },
      body: JSON.stringify(upPayload),
    });
    const upData = await upRes.json();
    if (!upRes.ok || upData.status !== "success") {
      console.error("UroPay generate failed", upRes.status, upData);
      throw new Error(upData?.message || `UroPay error ${upRes.status}`);
    }
    const d = upData.data;

    // Store intent with service role
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const dbPayload = purpose === "checkout"
      ? { items, coupon_code: couponCode, affiliate_slug: affiliateSlug }
      : null;

    const { error: insErr } = await admin.rpc("create_uropay_intent", {
      _user_id: userId,
      _purpose: purpose,
      _amount: amount,
      _uropay_order_id: d.uroPayOrderId,
      _merchant_order_id: merchantOrderId,
      _upi_string: d.upiString,
      _qr_code: d.qrCode,
      _payload: dbPayload,
    });
    if (insErr) throw insErr;

    return new Response(JSON.stringify({
      uropay_order_id: d.uroPayOrderId,
      upi_string: d.upiString,
      qr_code: d.qrCode,
      amount_rupees: d.amountInRupees,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("uropay-create error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
