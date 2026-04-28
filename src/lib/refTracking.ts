// Persists incoming ?ref= and ?aff= codes from URLs and tracks affiliate clicks.
import { supabase } from "@/integrations/supabase/client";

const REF_KEY = "streamcart.ref_code";
const AFF_KEY = "streamcart.aff_slug";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type Stored = { value: string; ts: number };

const read = (k: string): string | null => {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (Date.now() - parsed.ts > TTL_MS) { localStorage.removeItem(k); return null; }
    return parsed.value;
  } catch { return null; }
};

const write = (k: string, v: string) => {
  try { localStorage.setItem(k, JSON.stringify({ value: v, ts: Date.now() } as Stored)); } catch { /* ignore */ }
};

export function getStoredRefCode(): string | null { return read(REF_KEY); }
export function getStoredAffSlug(): string | null { return read(AFF_KEY); }
export function clearStoredRefCode() { try { localStorage.removeItem(REF_KEY); } catch { /* ignore */ } }

export async function captureUrlReferrals() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  const aff = params.get("aff");
  if (ref) write(REF_KEY, ref.trim().toUpperCase().slice(0, 32));
  if (aff) {
    const slug = aff.trim().toLowerCase().slice(0, 64);
    write(AFF_KEY, slug);
    // Fire-and-forget click tracking
    try {
      await supabase.rpc("track_affiliate_click", {
        _slug: slug,
        _ip: null,
        _ua: navigator.userAgent.slice(0, 240),
        _ref: document.referrer.slice(0, 240) || null,
        _path: window.location.pathname.slice(0, 240),
      });
    } catch { /* silent */ }
  }
  // Strip ?ref/?aff from URL without reload to keep it clean
  if (ref || aff) {
    params.delete("ref");
    params.delete("aff");
    const qs = params.toString();
    const next = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    window.history.replaceState({}, "", next);
  }
}
