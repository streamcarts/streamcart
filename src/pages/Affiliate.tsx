import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/format";
import { Copy, ExternalLink, MousePointerClick, ShoppingCart, IndianRupee, Percent, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { WithdrawDialog } from "@/components/WithdrawDialog";
import { EarningsHoldsCard } from "@/components/EarningsHoldsCard";

type Aff = {
  id: string;
  slug: string;
  commission_percent: number;
  status: string;
  total_clicks: number;
  total_conversions: number;
  total_earned: number;
};

type Conversion = { id: string; order_total: number; commission_amount: number; created_at: string; status: string };

const Affiliate = () => {
  const { user } = useAuth();
  const [aff, setAff] = useState<Aff | null | "none">(null);
  const [convs, setConvs] = useState<Conversion[]>([]);
  const [balance, setBalance] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);

  useEffect(() => {
    document.title = "Affiliate dashboard — StreamCart";
    if (user) load();
  }, [user]);

  const load = async () => {
    const { data } = await supabase
      .from("affiliates")
      .select("id,slug,commission_percent,status,total_clicks,total_conversions,total_earned")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (!data) { setAff("none"); return; }
    setAff(data as Aff);
    const { data: c } = await supabase
      .from("affiliate_conversions")
      .select("id,order_total,commission_amount,created_at,status")
      .eq("affiliate_id", data.id)
      .order("created_at", { ascending: false })
      .limit(25);
    setConvs((c as Conversion[]) ?? []);
    const { data: w } = await supabase.from("wallets").select("balance,pending_balance").eq("user_id", user!.id).maybeSingle();
    setBalance(Number(w?.balance ?? 0));
    setPendingBalance(Number((w as any)?.pending_balance ?? 0));
  };

  const link = aff && aff !== "none" ? `${window.location.origin}/?aff=${aff.slug}` : "";

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copied`); }
    catch { toast.error("Could not copy"); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-10 space-y-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Affiliate dashboard</h1>
            <p className="text-muted-foreground">Track clicks, conversions, and commissions.</p>
          </div>
          {aff && aff !== "none" && aff.status === "approved" && (
            <WithdrawDialog balance={balance} userId={user!.id} onDone={load} />
          )}
        </div>

        {aff === null ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : aff === "none" ? (
          <Card className="p-10 text-center">
            <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h2 className="text-lg font-semibold mb-1">Not an affiliate yet</h2>
            <p className="text-sm text-muted-foreground mb-5">
              The affiliate program is invitation-only. Reach out via support to apply.
            </p>
            <Button asChild><Link to="/buyer">Back to dashboard</Link></Button>
          </Card>
        ) : aff.status !== "approved" ? (
          <Card className="p-10 text-center">
            <Badge variant="secondary" className="mb-3 capitalize">{aff.status}</Badge>
            <h2 className="text-lg font-semibold">Your affiliate application is being reviewed</h2>
            <p className="text-sm text-muted-foreground mt-2">We'll notify you once it's approved.</p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={MousePointerClick} label="Clicks" value={String(aff.total_clicks)} />
              <StatCard icon={ShoppingCart} label="Conversions" value={String(aff.total_conversions)} />
              <StatCard icon={IndianRupee} label="Total earned" value={inr(aff.total_earned)} />
              <StatCard icon={Percent} label="Commission" value={`${aff.commission_percent}%`} />
            </div>

            <Card className="p-6 space-y-4">
              <h2 className="font-semibold">Your affiliate link</h2>
              <div className="flex gap-2">
                <Input readOnly value={link} />
                <Button variant="outline" onClick={() => copy(link, "Link")}><Copy className="h-4 w-4" /></Button>
                <Button asChild variant="outline"><a href={link} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Slug: <code className="font-mono">{aff.slug}</code> • Conversions credit your wallet instantly. Withdraw via the buyer dashboard.
              </p>
            </Card>

            <Card className="p-6">
              <h2 className="font-semibold mb-4">Recent conversions</h2>
              {convs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No conversions yet — keep sharing your link!</p>
              ) : (
                <div className="space-y-2">
                  {convs.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                      <span className="text-muted-foreground text-xs">{new Date(c.created_at).toLocaleString()}</span>
                      <span>{inr(c.order_total)}</span>
                      <Badge variant={c.status === "reversed" ? "destructive" : "default"}>+{inr(c.commission_amount)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <Card className="p-4">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-xl font-bold truncate">{value}</div>
      </div>
    </div>
  </Card>
);

export default Affiliate;
