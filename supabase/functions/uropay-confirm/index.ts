// Submit UPI reference number for an existing UroPay order, then poll status & complete.
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

    const { uropay_order_id, reference_number } = await req.json();
    if (!uropay_order_id || typeof uropay_order_id !== "string") throw new Error("uropay_order_id required");
    if (!reference_number || typeof reference_number !== "string" || reference_number.trim().length < 6) {
      throw new Error("Valid UPI reference number required");
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify ownership
    const { data: row, error: rowErr } = await admin
      .from("uropay_orders")
      .select("*")
      .eq("uropay_order_id", uropay_order_id)
      .maybeSingle();
    if (rowErr) throw rowErr;
    if (!row) throw new Error("Order not found");
    if (row.user_id !== userId) throw new Error("Forbidden");

    // Update with UroPay
    if (row.status !== "completed") {
      const hashedSecret = await sha512Hex(SECRET);
      const upRes = await fetch(`${UROPAY_URL}/order/update`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-API-KEY": API_KEY,
          "Authorization": `Bearer ${hashedSecret}`,
        },
        body: JSON.stringify({ uroPayOrderId: uropay_order_id, referenceNumber: reference_number.trim() }),
      });
      const upData = await upRes.json().catch(() => ({}));
      if (!upRes.ok) {
        console.error("UroPay update failed", upRes.status, upData);
        // Still record reference for admin review
      }

      await admin.from("uropay_orders")
        .update({ reference_number: reference_number.trim() })
        .eq("id", row.id);

      // Poll status quickly (up to ~6s)
      let finalStatus = "PENDING";
      for (let i = 0; i < 4; i++) {
        const sRes = await fetch(`${UROPAY_URL}/order/status/${encodeURIComponent(uropay_order_id)}`, {
          headers: { "Accept": "application/json", "Content-Type": "application/json", "X-API-KEY": API_KEY },
        });
        const sData = await sRes.json().catch(() => ({}));
        finalStatus = sData?.data?.orderStatus || finalStatus;
        if (finalStatus === "COMPLETED") break;
        await new Promise(r => setTimeout(r, 1500));
      }

      if (finalStatus === "COMPLETED") {
        if (row.purpose === "topup") {
          await admin.rpc("complete_uropay_topup", { _uropay_order_id: uropay_order_id });
        } else {
          await admin.rpc("complete_uropay_checkout", { _uropay_order_id: uropay_order_id });
        }
      }
    }

    // Re-fetch
    const { data: fresh } = await admin
      .from("uropay_orders")
      .select("status, result_ids, purpose")
      .eq("uropay_order_id", uropay_order_id)
      .maybeSingle();

    return new Response(JSON.stringify({
      status: fresh?.status ?? row.status,
      result_ids: fresh?.result_ids ?? null,
      purpose: fresh?.purpose ?? row.purpose,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("uropay-confirm error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
