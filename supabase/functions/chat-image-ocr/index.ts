// Scans a chat-image upload for contact info using Lovable AI vision.
// On success, calls send_chat_image RPC which either records the image OR
// blocks + flags the seller.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CONTACT_REGEX = {
  phone: /(?:\+?\d[\s\-]?){10,}/,
  email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  keyword: /(whats[\s\-]?app|telegram|t\.me\/|insta(gram)?|snapchat|signal app|wechat|contact me|dm me|message me on|call me|my number|gmail\.com|yahoo\.com|outlook\.com|hotmail\.com)/i,
  url: /(https?:\/\/|www\.)/i,
};

function detect(text: string): { found: boolean; reason: string | null } {
  if (!text) return { found: false, reason: null };
  if (CONTACT_REGEX.phone.test(text.replace(/[^\d+\s-]/g, ""))) return { found: true, reason: "phone_number" };
  if (CONTACT_REGEX.email.test(text)) return { found: true, reason: "email_address" };
  if (CONTACT_REGEX.keyword.test(text)) return { found: true, reason: "contact_keyword" };
  if (CONTACT_REGEX.url.test(text)) return { found: true, reason: "external_link" };
  return { found: false, reason: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "no auth" }), { status: 401, headers: corsHeaders });

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "not authenticated" }), { status: 401, headers: corsHeaders });

    const { chat_id, image_path } = await req.json();
    if (!chat_id || !image_path) {
      return new Response(JSON.stringify({ error: "chat_id and image_path required" }), { status: 400, headers: corsHeaders });
    }

    // Get a signed URL for the image so the model can read it
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: signed, error: signErr } = await admin.storage
      .from("chat-images").createSignedUrl(image_path, 120);
    if (signErr || !signed) {
      return new Response(JSON.stringify({ error: "image not accessible" }), { status: 400, headers: corsHeaders });
    }

    // OCR via Lovable AI (Gemini 2.5 Flash — fast & vision-capable)
    let ocrText = "";
    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "Extract ALL visible text from this image. Output only the raw text, nothing else. If no text, output 'NONE'." },
              { type: "image_url", image_url: { url: signed.signedUrl } },
            ],
          }],
        }),
      });
      if (aiRes.ok) {
        const j = await aiRes.json();
        ocrText = j?.choices?.[0]?.message?.content ?? "";
      }
    } catch (e) {
      console.error("OCR failed", e);
    }

    const verdict = detect(ocrText || "");

    // Forward to RPC as the calling user (so seller flag / fraud_flag tie to them)
    const { data: msgId, error: rpcErr } = await userClient.rpc("send_chat_image", {
      _chat_id: chat_id,
      _image_path: image_path,
      _ocr_text: ocrText.slice(0, 2000),
      _contact_detected: verdict.found,
      _detect_reason: verdict.reason,
    });
    if (rpcErr) {
      return new Response(JSON.stringify({ error: rpcErr.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      message_id: msgId,
      blocked: verdict.found,
      reason: verdict.reason,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("chat-image-ocr error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "internal error" }), { status: 500, headers: corsHeaders });
  }
});
