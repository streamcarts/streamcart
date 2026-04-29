// OCR a UPI payment screenshot using Lovable AI vision and update pending_orders
// with extracted amount + reference. Trigger then re-scores for auto-approval.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function ocrImage(dataUrl: string): Promise<{ amount: number | null; reference: string | null; raw: string }> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You are an OCR assistant for Indian UPI payment screenshots (GPay/PhonePe/Paytm). Extract the paid amount in rupees and the UPI Transaction ID / UTR / Reference number. Return only via the tool call.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the paid amount and UPI reference/UTR from this screenshot." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_payment",
            description: "Return parsed payment data",
            parameters: {
              type: "object",
              properties: {
                amount: {
                  type: ["number", "null"],
                  description: "Amount paid in INR (e.g. 70.13). Null if not detected.",
                },
                reference: {
                  type: ["string", "null"],
                  description: "UPI Transaction ID / UTR / Reference number (alphanumeric). Null if not detected.",
                },
              },
              required: ["amount", "reference"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_payment" } },
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI gateway ${resp.status}: ${t}`);
  }
  const data = await resp.json();
  const call = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  let parsed: any = {};
  try {
    parsed = typeof call === "string" ? JSON.parse(call) : call ?? {};
  } catch {
    parsed = {};
  }
  return {
    amount: typeof parsed.amount === "number" ? parsed.amount : null,
    reference: typeof parsed.reference === "string" ? parsed.reference : null,
    raw: JSON.stringify(parsed),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pending_order_id } = await req.json();
    if (!pending_order_id) {
      return new Response(JSON.stringify({ error: "pending_order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: po, error: poErr } = await admin
      .from("pending_orders")
      .select("id, screenshot_path, ocr_status, status")
      .eq("id", pending_order_id)
      .maybeSingle();

    if (poErr || !po) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (po.ocr_status === "done") {
      return new Response(JSON.stringify({ ok: true, skipped: "already done" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download screenshot
    const { data: file, error: dlErr } = await admin.storage
      .from("payment-screenshots")
      .download(po.screenshot_path);
    if (dlErr || !file) {
      await admin.from("pending_orders").update({ ocr_status: "failed", ocr_processed_at: new Date().toISOString() }).eq("id", po.id);
      throw dlErr ?? new Error("download failed");
    }

    const buf = new Uint8Array(await file.arrayBuffer());
    // base64 encode
    let binary = "";
    for (let i = 0; i < buf.byteLength; i++) binary += String.fromCharCode(buf[i]);
    const b64 = btoa(binary);
    const mime = file.type || "image/jpeg";
    const dataUrl = `data:${mime};base64,${b64}`;

    let result;
    try {
      result = await ocrImage(dataUrl);
    } catch (err) {
      console.error("OCR failed:", err);
      await admin
        .from("pending_orders")
        .update({ ocr_status: "failed", ocr_raw: String(err), ocr_processed_at: new Date().toISOString() })
        .eq("id", po.id);
      return new Response(JSON.stringify({ ok: false, error: String(err) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: upErr } = await admin
      .from("pending_orders")
      .update({
        ocr_amount: result.amount,
        ocr_reference: result.reference,
        ocr_raw: result.raw,
        ocr_status: "done",
        ocr_processed_at: new Date().toISOString(),
      })
      .eq("id", po.id);
    if (upErr) throw upErr;

    return new Response(
      JSON.stringify({ ok: true, amount: result.amount, reference: result.reference }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ocr-payment error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
