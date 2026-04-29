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
  Loader2, ChevronLeft, MessageSquareText, ShieldCheck, Smartphone, Tv, Mail, Phone, Sparkles, Lock,
} from "lucide-react";

const PLATFORMS = ["Netflix", "Amazon Prime Video", "Disney+ Hotstar", "SonyLIV", "ZEE5", "JioCinema", "Apple TV+", "Spotify", "YouTube Premium", "ChatGPT Plus", "Canva Pro", "Adobe Creative Cloud", "NordVPN", "Other"];
const PLAN_NAMES = ["Mobile", "Basic", "Standard", "Premium", "4K UHD", "Family", "Individual", "Annual"];
const DEVICE_TYPES = [
  { id: "Mobile Only", icon: Smartphone },
  { id: "TV / PC Only", icon: Tv },
  { id: "Own Mail", icon: Mail },
  { id: "Own Number", icon: Phone },
];
const TIER_DEFS = [
  { key: "15d", label: "15 Days" },
  { key: "30d", label: "30 Days" },
  { key: "45d", label: "45 Days" },
  { key: "3m", label: "3 Months" },
];

const CATEGORY_FOR_PLATFORM: Record<string, string> = {
  "Netflix": "OTT", "Amazon Prime Video": "OTT", "Disney+ Hotstar": "OTT", "SonyLIV": "OTT",
  "ZEE5": "OTT", "JioCinema": "OTT", "Apple TV+": "OTT",
  "Spotify": "Other", "YouTube Premium": "Other",
  "ChatGPT Plus": "AI Tools", "Canva Pro": "Other", "Adobe Creative Cloud": "Other",
  "NordVPN": "VPN", "Other": "Other",
};

const SellerListChat = () => {
  const { user, isSeller, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const [platform, setPlatform] = useState("Netflix");
  const [plan, setPlan] = useState("Premium");
  const [deviceLogins, setDeviceLogins] = useState("1");
  const [deviceTypes, setDeviceTypes] = useState<string[]>(["Mobile Only"]);
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [tiers, setTiers] = useState<Record<string, string>>({ "15d": "", "30d": "", "45d": "", "3m": "" });

  useEffect(() => { document.title = "List subscription — StreamCart"; }, []);
  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate("/auth?next=/seller/list-chat");
    else if (!isSeller) navigate("/sell");
  }, [user, isSeller, authLoading, navigate]);

  const wordCount = useMemo(() => description.trim().split(/\s+/).filter(Boolean).length, [description]);

  const toggleDevice = (id: string) => {
    setDeviceTypes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deviceTypes.length === 0) return toast.error("Select at least one device type");
    if (wordCount > 200) return toast.error("Description must be 200 words or less");

    const filledTiers = TIER_DEFS
      .map((t) => ({ key: t.key, label: t.label, price: parseFloat(tiers[t.key]) }))
      .filter((t) => !isNaN(t.price) && t.price > 0);
    if (filledTiers.length === 0) return toast.error("Add a price for at least one duration");

    const minBase = Math.min(...filledTiers.map((t) => t.price));
    const category = CATEGORY_FOR_PLATFORM[platform] ?? "Other";

    setBusy(true);
    try {
      const serviceName = `${platform} ${plan}`.trim();
      const { error } = await supabase.from("products").insert({
        seller_id: user!.id,
        service_name: serviceName,
        description: description.trim() || null,
        category: category as any,
        base_price: minBase,
        // display_price gets set automatically by trigger
        duration: filledTiers[0].label,
        delivery_mode: "chat",
        platform,
        plan_name: plan,
        device_logins: parseInt(deviceLogins) || 1,
        device_types: deviceTypes,
        is_private_account: isPrivate,
        price_tiers: filledTiers,
        stock: 99, // chat-delivery uses unlimited slots; seller fulfils each
        is_active: true,
        credentials_email: null,
        credentials_password: null,
      } as any);
      if (error) throw error;
      toast.success("Listing created! It's now live for buyers.");
      navigate("/seller");
    } catch (err: any) {
      toast.error(err.message ?? "Could not create listing");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-8 max-w-3xl">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <a href="/seller"><ChevronLeft className="h-4 w-4 mr-1" /> Back to dashboard</a>
        </Button>

        <div className="flex items-center gap-2 mb-2">
          <Badge className="bg-primary/10 text-primary hover:bg-primary/15"><MessageSquareText className="h-3 w-3 mr-1" /> Chat delivery</Badge>
          <Badge variant="outline"><ShieldCheck className="h-3 w-3 mr-1" /> No credentials needed now</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">List your subscription</h1>
        <p className="text-muted-foreground mt-1 mb-6">
          Buyer ke order karte hi tumhare paas chat khulega. Login details wahan se share karna — phone/WhatsApp/email share karna strictly banned hai.
        </p>

        <form onSubmit={submit} className="space-y-6">
          {/* Basic Info */}
          <Card className="p-6 space-y-5">
            <h2 className="font-semibold">Basic info</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Plan / Category</Label>
                <Select value={plan} onValueChange={setPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLAN_NAMES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Device logins</Label>
                <Select value={deviceLogins} onValueChange={setDeviceLogins}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["1","2","3","4","5","6"].map((n) => <SelectItem key={n} value={n}>{n} screen{n === "1" ? "" : "s"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Device type */}
          <Card className="p-6 space-y-3">
            <h2 className="font-semibold">Device type</h2>
            <p className="text-xs text-muted-foreground">Select all that apply.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {DEVICE_TYPES.map((d) => {
                const active = deviceTypes.includes(d.id);
                const Icon = d.icon;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDevice(d.id)}
                    className={`rounded-lg border p-3 text-sm font-medium transition flex flex-col items-center gap-1.5 ${
                      active
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border bg-background hover:border-primary/40 hover:bg-accent/40"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {d.id}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Description */}
          <Card className="p-6 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Description</h2>
              <span className={`text-xs ${wordCount > 200 ? "text-destructive" : "text-muted-foreground"}`}>{wordCount}/200 words</span>
            </div>
            <Textarea
              rows={5}
              placeholder="Describe what buyer will get…"
              maxLength={1500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Card>

          {/* Pricing */}
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Pricing (₹)</h2>
              <div className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                <Label htmlFor="priv" className="text-sm">Private account / profile</Label>
                <Switch id="priv" checked={isPrivate} onCheckedChange={setIsPrivate} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Tum jo price doge, buyer ko 10% markup ke saath dikhega. Sirf woh durations fill karo jo tum offer karna chahte ho.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {TIER_DEFS.map((t) => (
                <div key={t.key} className="space-y-1.5">
                  <Label htmlFor={`p-${t.key}`}>{t.label}</Label>
                  <Input
                    id={`p-${t.key}`} type="number" min="0" step="1" placeholder="₹0"
                    value={tiers[t.key]}
                    onChange={(e) => setTiers({ ...tiers, [t.key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* Trust */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm flex gap-3 items-start">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <strong className="text-foreground">Chat delivery only.</strong> No external contact (phone, WhatsApp, Telegram, email) is allowed. 3+ violations = automatic ban.
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
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
