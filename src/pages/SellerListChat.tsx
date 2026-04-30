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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2, ChevronLeft, MessageSquareText, ShieldCheck, Sparkles, Lock, AlertTriangle, CheckCircle2, Package,
} from "lucide-react";

type Platform = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  category: string;
  is_active: boolean;
  plan_tiers?: string[] | null;
};
type Duration = { id: string; label: string; days: number; sort_order: number; is_active: boolean };
type Pricing = { platform_id: string; duration_id: string; min_price: number };

const FALLBACK_PLAN_NAMES = ["Mobile", "Basic", "Standard", "Premium"];

const SellerListChat = () => {
  const { user, isSeller, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [durations, setDurations] = useState<Duration[]>([]);
  const [pricing, setPricing] = useState<Pricing[]>([]);

  const [platformId, setPlatformId] = useState<string>("");
  const [plan, setPlan] = useState("Premium");
  const [title, setTitle] = useState("");
  const [slots, setSlots] = useState("1");
  const [accountType, setAccountType] = useState<"shared" | "private">("shared");
  const [description, setDescription] = useState("");
  // priceByDuration: durationId -> string
  const [priceByDuration, setPriceByDuration] = useState<Record<string, string>>({});

  useEffect(() => { document.title = "List subscription — StreamCart"; }, []);
  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate("/auth?next=/seller/list-chat");
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
      if (pRes.data && (pRes.data as any[]).length > 0 && !platformId) {
        setPlatformId((pRes.data as any[])[0].id);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedPlatform = useMemo(
    () => platforms.find((p) => p.id === platformId) || null,
    [platforms, platformId],
  );

  // Plan tiers come from selected platform (admin-defined)
  const planOptions = useMemo(() => {
    const t = selectedPlatform?.plan_tiers;
    return t && t.length > 0 ? t : FALLBACK_PLAN_NAMES;
  }, [selectedPlatform]);

  // Reset plan when platform changes / its options change
  useEffect(() => {
    if (planOptions.length === 0) return;
    if (!planOptions.includes(plan)) setPlan(planOptions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planOptions]);

  // Auto-fill title when platform/plan changes (only if user hasn't customised)
  const [titleEdited, setTitleEdited] = useState(false);
  useEffect(() => {
    if (titleEdited) return;
    if (selectedPlatform) setTitle(`${selectedPlatform.name} ${plan}`.trim());
  }, [selectedPlatform, plan, titleEdited]);

  const minPriceFor = (durationId: string): number | null => {
    if (!platformId) return null;
    const row = pricing.find((r) => r.platform_id === platformId && r.duration_id === durationId);
    return row ? Number(row.min_price) : null;
  };

  const wordCount = useMemo(
    () => description.trim().split(/\s+/).filter(Boolean).length,
    [description],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlatform) return toast.error("Please select a platform");
    if (!title.trim()) return toast.error("Title required");
    if (wordCount > 200) return toast.error("Description must be 200 words or less");

    // Validate pricing: must include at least one duration with valid price >= min
    const filledTiers: { key: string; label: string; price: number }[] = [];
    for (const d of durations) {
      const raw = priceByDuration[d.id];
      if (!raw || raw.trim() === "") continue;
      const price = parseFloat(raw);
      if (isNaN(price) || price <= 0) {
        return toast.error(`Invalid price for ${d.label}`);
      }
      const min = minPriceFor(d.id);
      if (min != null && price < min) {
        return toast.error(`${d.label}: price must be at least ₹${min}`);
      }
      filledTiers.push({ key: d.label.toLowerCase().replace(/\s+/g, ""), label: d.label, price });
    }
    if (filledTiers.length === 0) return toast.error("Add a price for at least one duration");

    const minBase = Math.min(...filledTiers.map((t) => t.price));
    setBusy(true);
    try {
      const { error } = await supabase.from("products").insert({
        seller_id: user!.id,
        service_name: title.trim(),
        description: description.trim() || null,
        category: selectedPlatform.category as any,
        base_price: minBase,
        duration: filledTiers[0].label,
        delivery_mode: "chat",
        platform: selectedPlatform.name,
        platform_id: selectedPlatform.id,
        plan_name: plan,
        device_logins: parseInt(slots) || 1,
        device_types: [],
        is_private_account: accountType === "private",
        price_tiers: filledTiers,
        image_url: selectedPlatform.logo_url,
        stock: 99,
        is_active: true,
        credentials_email: null,
        credentials_password: null,
      } as any);
      if (error) throw error;
      toast.success("Listing created! It's now live for buyers.");
      navigate("/seller");
    } catch (err: any) {
      toast.error(err.message ?? "Could not create listing");
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
            <MessageSquareText className="h-3 w-3 mr-1" /> Chat delivery
          </Badge>
          <Badge variant="outline">
            <ShieldCheck className="h-3 w-3 mr-1" /> Admin-controlled pricing
          </Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">List your subscription</h1>
        <p className="text-muted-foreground mt-1 mb-6">
          Sirf admin-approved platforms hi list ho sakte hain. Tum sirf apna price set karte ho — minimum admin tay karta hai.
        </p>

        <form onSubmit={submit} className="space-y-6">
          {/* Platform selection */}
          <Card className="p-6 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" /> Platform
            </h2>
            {platforms.length === 0 ? (
              <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-4">
                No platforms configured yet. Please contact support.
              </div>
            ) : (
              <Select value={platformId} onValueChange={(v) => setPlatformId(v)}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select a platform" />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        {p.logo_url ? (
                          <img src={p.logo_url} alt={p.name} className="h-5 w-5 object-contain rounded" />
                        ) : (
                          <div className="h-5 w-5 bg-muted rounded flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                            {p.name.charAt(0)}
                          </div>
                        )}
                        <span>{p.name}</span>
                        <span className="text-xs text-muted-foreground ml-1">· {p.category}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {selectedPlatform && (
              <div className="flex items-center gap-3 rounded-lg border bg-accent/30 px-3 py-2">
                {selectedPlatform.logo_url ? (
                  <img src={selectedPlatform.logo_url} alt={selectedPlatform.name} className="h-10 w-10 object-contain rounded" />
                ) : (
                  <div className="h-10 w-10 bg-primary/10 rounded flex items-center justify-center font-bold text-primary">
                    {selectedPlatform.name.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="font-medium text-sm">{selectedPlatform.name}</div>
                  <div className="text-xs text-muted-foreground">{selectedPlatform.category}</div>
                </div>
              </div>
            )}
          </Card>

          {/* Title + plan */}
          <Card className="p-6 space-y-5">
            <h2 className="font-semibold">Plan & Title</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Plan / Tier</Label>
                <Select value={plan} onValueChange={(v) => { setPlan(v); setTitleEdited(false); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {planOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setTitleEdited(true); }}
                  placeholder="e.g. Netflix Premium 4K"
                  maxLength={80}
                />
              </div>
            </div>
          </Card>

          {/* Slots & account type */}
          <Card className="p-6 space-y-5">
            <h2 className="font-semibold">Slots & Account type</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Slots / Devices</Label>
                <Select value={slots} onValueChange={setSlots}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["1","2","3","4"].map((n) => (
                      <SelectItem key={n} value={n}>{n} Slot{n === "1" ? "" : "s"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Account type</Label>
                <div className="flex items-center gap-3 rounded-lg border h-10 px-3">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm flex-1">{accountType === "private" ? "Private" : "Shared"}</span>
                  <Switch
                    checked={accountType === "private"}
                    onCheckedChange={(v) => setAccountType(v ? "private" : "shared")}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Description */}
          <Card className="p-6 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Description <span className="text-xs font-normal text-muted-foreground">(optional)</span></h2>
              <span className={`text-xs ${wordCount > 200 ? "text-destructive" : "text-muted-foreground"}`}>{wordCount}/200 words</span>
            </div>
            <Textarea
              rows={4}
              placeholder="Describe what buyer will get…"
              maxLength={1500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Card>

          {/* Pricing */}
          <Card className="p-6 space-y-4">
            <div>
              <h2 className="font-semibold">Pricing (₹)</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Sirf woh durations fill karo jo tum offer karna chahte ho. Buyer ko 10% markup ke saath dikhega.
                Minimum prices admin ne lock kiye hain — neeche jana not allowed.
              </p>
            </div>

            {durations.length === 0 ? (
              <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-4">
                No durations configured.
              </div>
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
                          {min != null ? (
                            <span className="text-xs text-muted-foreground">Min ₹{min}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not allowed for this platform</span>
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
                        disabled={min == null}
                        value={raw}
                        onChange={(e) => setPriceByDuration({ ...priceByDuration, [d.id]: e.target.value })}
                        className={tooLow ? "border-destructive focus-visible:ring-destructive" : ""}
                      />
                      {tooLow && (
                        <div className="text-xs text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Below admin minimum (₹{min}). Increase to list.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Trust */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm flex gap-3 items-start">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <strong className="text-foreground">Chat delivery only.</strong> Sharing phone, WhatsApp, Telegram, email or external links in chat is strictly banned. 3+ violations = automatic ban.
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={busy || platforms.length === 0}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            List Your Subscription Now
          </Button>
        </form>
      </main>
      <Footer />
    </div>
  );
};

export default SellerListChat;
