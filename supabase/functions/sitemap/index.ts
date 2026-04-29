// Dynamic sitemap.xml — lists homepage, static pages, and all approved products
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SITE = "https://streamcart.lovable.app";

Deno.serve(async () => {
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data } = await sb
      .from("products")
      .select("slug,id,updated_at")
      .eq("status", "approved")
      .order("updated_at", { ascending: false })
      .limit(5000);

    const staticUrls = ["", "/browse", "/about", "/terms", "/privacy", "/refund"];
    const urls: string[] = [];
    for (const path of staticUrls) {
      urls.push(`<url><loc>${SITE}${path}</loc><changefreq>daily</changefreq><priority>${path === "" ? "1.0" : "0.7"}</priority></url>`);
    }
    for (const p of data ?? []) {
      const slug = (p as any).slug ?? (p as any).id;
      const lastmod = new Date((p as any).updated_at).toISOString();
      urls.push(`<url><loc>${SITE}/p/${slug}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
    return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
  } catch (e) {
    return new Response(`<!-- sitemap error: ${e instanceof Error ? e.message : "unknown"} -->`, { status: 500, headers: { "Content-Type": "application/xml" } });
  }
});
