import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Loader2, ChevronLeft, Package, ShieldCheck, Sparkles, AlertTriangle, CheckCircle2, Box,
} from "lucide-react";
import packCover from "@/assets/pack-ott.png";

type Platform = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  category: string;
  is_active: boolean;
};
type Duration = { id: string; label: string; days: number; sort_order: number; is_active: boolean };
type Pricing = { platform_id: string; duration_id: string; min_price: number };

const SellerListPack = () => {
  const { user, isSeller, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [durations, setDurations] = useState<Duration[]>([]);
  const [pricing, setPricing] = useState<Pricing[]>([]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState("OTT Mega Pack");
  const [description, setDescription] = useState("");
  const [priceByDuration, setPriceByDuration] = useState<Record<string, string>>({});

  useEffect(() => { document.title = "Create a Pack — StreamCart"; }, []);
  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate("/auth?next=/seller/list-pack");
    else if (!isSeller) navigate("/sell");
  }, [user, isSeller, authLoading, navigate]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [pRes, dRes, prRes] = await Promise.all([
        supabase.from("platforms" as any).select("*").eq("is_active", true).order("sort_order"),
        supabase.from("platform_durations" as any).select("*").eq("is_active", true).order("sort_order"),
        supabase.from("platform_pricing" as any).select("platform_id,duration_id,min_price"),
      ]);
      if (!pRes.error && pRes.data) setPlatforms(pRes.data as any);
      if (!dRes.error && dRes.data) setDurations(dRes.data as any);
      if (!prRes.error && prRes.data) setPricing(prRes.data as any);
      setLoading(false);
    })();
  }, []);

  const togglePlatform = (id: string) =>
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  // Per-duration min = sum of min prices of every selected platform for that duration
  const minPriceFor = (durationId: string): number | null => {
    if (selectedIds.length === 0) return null;
    let sum = 0;
    for (const pid of selectedIds) {
      const row = pricing.find((r) => r.platform_id === pid && r.duration_id === durationId);
      if (!row) return null; // every platform must be priced for this duration
      sum += Number(row.min_price);
    }
    return sum;
  };

  const wordCount = useMemo(
    () => description.trim().split(/\s+/).filter(Boolean).length,
    [description],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length < 2) return toast.error("Pick at least 2 platforms for a Pack");
    if (!title.trim()) return toast.error("Pack title required");
    if (wordCount > 200) return toast.error("Description must be 200 words or less");

    const filledTiers: { key: string; label: string; price: number }[] = [];
    for (const d of durations) {
      const raw = priceByDuration[d.id];
      if (!raw || raw.trim() === "") continue;
      const price = parseFloat(raw);
      if (isNaN(price) || price <= 0) return toast.error(`Invalid price for ${d.label}`);
      const min = minPriceFor(d.id);
      if (min != null && price < min) return toast.error(`${d.label}: pack price must be at least ₹${min}`);
      filledTiers.push({ key: d.label.toLowerCase().replace(/\s+/g, ""), label: d.label, price });
    }
    if (filledTiers.length === 0) return toast.error("Add a price for at least one duration");

    const minBase = Math.min(...filledTiers.map((t) => t.price));
    const selectedPlatforms = platforms.filter((p) => selectedIds.includes(p.id));
    const packPlatforms = selectedPlatforms.map((p) => ({ id: p.id, name: p.name, logo_url: p.logo_url }));

    setBusy(true);
    try {
      const { error } = await supabase.from("products").insert({
        seller_id: user!.id,
        service_name: title.trim(),
        description: description.trim() || null,
        category: "Packs",
        base_price: minBase,
        duration: filledTiers[0].label,
        delivery_mode: "chat",
        platform: selectedPlatforms.map((p) => p.name).join(" + "),
        platform_id: null,
        plan_name: "Pack",
        device_logins: 1,
        device_types: [],
        is_private_account: false,
        price_tiers: filledTiers,
        image_url: packCover,
        stock: 99,
        is_active: true,
        is_pack: true,
        pack_platforms: packPlatforms,
        credentials_email: null,
        credentials_password: null,
      } as any);
      if (error) throw error;
      toast.success("Pack created! It's now live for buyers.");
      navigate("/seller");
    } catch (err: any) {
      toast.error(err.message ?? "Could not create pack");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-8 max-w-3xl">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <a href="/seller"><ChevronLeft className="h-4 w-4 mr-1" /> Back to dashboard</a>
        </Button>

        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Badge className="bg-primary/10 text-primary hover:bg-primary/15">
            <Box className="h-3 w-3 mr-1" /> Multi-platform Pack
          </Badge>
          <Badge variant="outline">
            <ShieldCheck className="h-3 w-3 mr-1" /> Chat delivery
          </Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Create a Pack listing</h1>
        <p className="text-muted-foreground mt-1 mb-6">
          Combine 2+ platforms in one listing. Buyer ko ek hi order me poora bundle milta hai.
        </p>

        {/* Pack cover preview */}
        <Card className="p-4 mb-6 flex items-center gap-4">
          <img src={packCover} alt="OTT Pack" className="h-20 w-32 object-cover rounded-lg border" />
          <div className="text-sm">
            <div className="font-semibold">Default pack cover</div>
            <div className="text-muted-foreground text-xs">Sab packs ke liye yahi cover use hota hai.</div>
          </div>
        </Card>

        <form onSubmit={submit} className="space-y-6">
          {/* Platform multi-select */}
          <Card className="p-6 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" /> Pick platforms in this pack
              <span className="ml-auto text-xs text-muted-foreground font-normal">{selectedIds.length} selected</span>
            </h2>
            {platforms.length === 0 ? (
              <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-4">
                No platforms configured. Contact admin.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {platforms.map((p) => {
                  const checked = selectedIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                        checked ? "border-primary bg-primary/5" : "hover:bg-accent"
                      }`}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => togglePlatform(p.id)} />
                      {p.logo_url ? (
                        <img src={p.logo_url} alt={p.name} className="h-6 w-6 object-contain rounded" />
                      ) : (
                        <div className="h-6 w-6 bg-muted rounded flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                          {p.name.charAt(0)}
                        </div>
                      )}
                      <span className="text-sm font-medium truncate">{p.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Title + description */}
          <Card className="p-6 space-y-5">
            <div className="space-y-1.5">
              <Label>Pack title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. OTT Mega Pack"
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Description <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
                <span className={`text-xs ${wordCount > 200 ? "text-destructive" : "text-muted-foreground"}`}>{wordCount}/200 words</span>
              </div>
              <Textarea
                rows={3}
                placeholder="Describe what's included in this pack…"
                maxLength={1500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </Card>

          {/* Pricing */}
          <Card className="p-6 space-y-4">
            <div>
              <h2 className="font-semibold">Pack pricing (₹)</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Minimum = sum of admin minimums across selected platforms. Buyer ko 10% markup ke saath dikhega.
              </p>
            </div>

            {durations.length === 0 ? (
              <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-4">No durations configured.</div>
            ) : (
              <div className="space-y-3">
                {durations.map((d) => {
                  const min = minPriceFor(d.id);
                  const raw = priceByDuration[d.id] ?? "";
                  const num = parseFloat(raw);
                  const hasVal = !isNaN(num) && num > 0;
                  const tooLow = hasVal && min != null && num < min;
                  const ok = hasVal && (min == null || num >= min);
                  return (
                    <div key={d.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{d.label}</Badge>
                          {selectedIds.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Pick platforms first</span>
                          ) : min != null ? (
                            <span className="text-xs text-muted-foreground">Min ₹{min} (sum of platforms)</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not all platforms support this duration</span>
                          )}
                        </div>
                        {ok && (
                          <Badge className="bg-primary/10 text-primary hover:bg-primary/15">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Buyer sees ₹{Math.round(num * 1.1)}
                          </Badge>
                        )}
                      </div>
                      <Input
                        type="number" min="0" step="1"
                        placeholder={min != null ? `Min ₹${min}` : "Set price"}
                        disabled={selectedIds.length === 0 || min == null}
                        value={raw}
                        onChange={(e) => setPriceByDuration({ ...priceByDuration, [d.id]: e.target.value })}
                        className={tooLow ? "border-destructive focus-visible:ring-destructive" : ""}
                      />
                      {tooLow && (
                        <div className="text-xs text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Below pack minimum (₹{min}).
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm flex gap-3 items-start">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <strong className="text-foreground">Chat delivery only.</strong> Sharing phone, WhatsApp, Telegram or external links in chat is banned.
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={busy || selectedIds.length < 2}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Publish Pack
          </Button>
        </form>
      </main>
      <Footer />
    </div>
  );
};

export default SellerListPack;
