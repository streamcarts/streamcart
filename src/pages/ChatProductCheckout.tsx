import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { inr } from "@/lib/format";
import { ChevronLeft, Loader2, MessageSquareText, ShieldCheck, Users, Smartphone, Lock, Sparkles } from "lucide-react";

type Product = {
  id: string; service_name: string; description: string | null; category: string;
  display_price: number; image_url: string | null; seller_id: string;
  delivery_mode: string; platform: string | null; plan_name: string | null;
  device_logins: number | null; device_types: string[]; is_private_account: boolean;
  price_tiers: { key: string; label: string; price: number }[];
  avg_rating: number; rating_count: number;
};

const ChatProductCheckout = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [p, setP] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "Buy subscription — StreamCart"; }, []);
  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id).eq("status", "approved").maybeSingle();
      if (error || !data) { toast.error("Not available"); navigate("/browse"); return; }
      setP(data as Product);
      const tiers = (data.price_tiers as any[]) ?? [];
      if (tiers.length > 0) setTier(tiers[0].key);
      setLoading(false);
    })();
  }, [id, navigate]);

  const selectedTier = useMemo(() => p?.price_tiers?.find((t) => t.key === tier), [p, tier]);
  const displayPrice = useMemo(() => selectedTier ? Math.round(selectedTier.price * 1.10 * 100) / 100 : 0, [selectedTier]);

  const buy = async () => {
    if (!user) return navigate(`/auth?next=/chat-buy/${id}`);
    if (!p || !selectedTier) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("purchase_chat_product", {
        _product_id: p.id, _tier_label: selectedTier.label, _tier_price: displayPrice,
      });
      if (error) throw error;
      toast.success("Order placed! Chat with seller now.");
      navigate(`/orders/chat/${data}`);
    } catch (err: any) {
      if ((err.message || "").includes("Insufficient")) {
        toast.error("Wallet me paise kam hain — top-up karo");
        navigate("/buyer");
      } else toast.error(err.message ?? "Failed");
    } finally { setBusy(false); }
  };

  if (loading || !p) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar /><main className="flex-1 container py-10 max-w-2xl"><Skeleton className="h-96 w-full" /></main><Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-8 max-w-2xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3 -ml-2"><ChevronLeft className="h-4 w-4 mr-1" />Back</Button>
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/15"><MessageSquareText className="h-3 w-3 mr-1" />Chat delivery</Badge>
            {p.is_private_account && <Badge variant="outline"><Lock className="h-3 w-3 mr-1" />Private profile</Badge>}
          </div>
          <h1 className="text-2xl font-bold">{p.service_name}</h1>
          {p.description && <p className="text-sm text-muted-foreground whitespace-pre-line">{p.description}</p>}

          <div className="grid grid-cols-2 gap-3 text-sm">
            {p.device_logins && <Stat icon={<Users className="h-4 w-4" />} label="Logins" value={`${p.device_logins} screen${p.device_logins>1?"s":""}`} />}
            <Stat icon={<Smartphone className="h-4 w-4" />} label="Devices" value={(p.device_types || []).join(", ") || "Any"} />
          </div>

          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Choose duration</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(p.price_tiers || []).map((t) => {
                const dp = Math.round(t.price * 1.10 * 100) / 100;
                const active = tier === t.key;
                return (
                  <button key={t.key} onClick={() => setTier(t.key)}
                    className={`rounded-lg border p-3 text-center transition ${active ? "border-primary bg-primary/10 shadow-sm" : "border-border hover:border-primary/40"}`}>
                    <div className="text-xs text-muted-foreground">{t.label}</div>
                    <div className={`font-bold ${active ? "text-primary" : ""}`}>{inr(dp)}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs flex gap-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>Seller will deliver login credentials in a secure in-app chat. No phone, WhatsApp or Telegram allowed.</div>
          </div>

          <div className="flex items-baseline justify-between border-t border-border pt-4">
            <div>
              <div className="text-xs text-muted-foreground">You pay</div>
              <div className="text-3xl font-bold text-primary">{inr(displayPrice)}</div>
            </div>
            <Button size="lg" onClick={buy} disabled={busy || !selectedTier}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Buy & start chat
            </Button>
          </div>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-lg border border-border p-3 flex items-center gap-2">
    <div className="text-primary">{icon}</div>
    <div className="min-w-0">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  </div>
);

export default ChatProductCheckout;
