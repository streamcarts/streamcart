import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { inr } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Lock, Wallet, ArrowRight, ShoppingBag, TicketPercent, X, CheckCircle2, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";

type Settings = { upi_id: string; commission_percent: number };

const Checkout = () => {
  const { items, subtotal, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);

  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    document.title = "Checkout — StreamCart";
    if (!user) { navigate("/auth?next=/checkout"); return; }
    if (items.length === 0) { navigate("/cart"); return; }
    Promise.all([
      supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
      supabase.from("platform_settings").select("upi_id,commission_percent").eq("id", 1).maybeSingle(),
    ]).then(([w, s]) => {
      setBalance(Number(w.data?.balance ?? 0));
      setSettings((s.data as Settings) ?? { upi_id: "streamcart@upi", commission_percent: 10 });
    });
  }, [user, items.length, navigate]);

  const total = Math.max(0, subtotal - couponDiscount);
  const insufficient = balance !== null && balance < total;

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return toast.error("Enter a coupon code");
    setValidating(true);
    setCouponMsg(null);
    try {
      const { data, error } = await supabase.rpc("validate_coupon", { _code: code, _subtotal: subtotal });
      if (error) throw error;
      const row = (data as any[])?.[0];
      if (!row || !row.coupon_id) {
        setCouponCode(null);
        setCouponDiscount(0);
        setCouponMsg(row?.message ?? "Invalid coupon");
        toast.error(row?.message ?? "Invalid coupon");
        return;
      }
      setCouponCode(code);
      setCouponDiscount(Number(row.discount));
      setCouponMsg(`Coupon applied — you save ${inr(Number(row.discount))}`);
      toast.success(`Coupon applied! Saved ${inr(Number(row.discount))}`);
    } catch (err: any) {
      toast.error(err.message ?? "Could not validate");
    } finally { setValidating(false); }
  };

  const removeCoupon = () => {
    setCouponCode(null);
    setCouponDiscount(0);
    setCouponInput("");
    setCouponMsg(null);
  };

  const placeOrder = async () => {
    if (!user || items.length === 0) return;
    setProcessing(true);
    const orderIds: string[] = [];
    let appliedOnce = false;
    const affSlug = (await import("@/lib/refTracking")).getStoredAffSlug();
    try {
      for (const it of items) {
        for (let i = 0; i < it.qty; i++) {
          const args: any = { _product_id: it.id };
          if (couponCode && !appliedOnce) {
            args._coupon_code = couponCode;
            appliedOnce = true;
          }
          if (affSlug) args._affiliate_slug = affSlug;
          const { data, error } = await supabase.rpc("purchase_product", args);
          if (error) throw error;
          if (data) orderIds.push(data as string);
        }
      }
      clear();
      toast.success(`Order placed! ${orderIds.length} item${orderIds.length > 1 ? "s" : ""} delivered instantly.`);
      navigate(`/success?ids=${orderIds.join(",")}`);
    } catch (err: any) {
      toast.error(err.message || "Checkout failed");
    } finally {
      setProcessing(false);
    }
  };

  if (!user || items.length === 0) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-10 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <section className="card-elevated p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> Order items</h2>
              <div className="space-y-3">
                {items.map((it) => (
                  <div key={it.id} className="flex justify-between items-center text-sm py-2 border-b border-border last:border-0">
                    <div>
                      <div className="font-medium">{it.service_name}</div>
                      <div className="text-xs text-muted-foreground">{it.category} × {it.qty}</div>
                    </div>
                    <div className="font-semibold">{inr(Number(it.display_price) * it.qty)}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Coupon */}
            <section className="card-elevated p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2"><TicketPercent className="h-4 w-4" /> Have a coupon?</h2>
              {couponCode ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span><Badge className="mr-2">{couponCode}</Badge>{couponMsg}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={removeCoupon}>
                    <X className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Label htmlFor="coupon" className="sr-only">Coupon code</Label>
                    <Input
                      id="coupon"
                      placeholder="Enter coupon code"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      maxLength={32}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } }}
                    />
                    <Button onClick={applyCoupon} disabled={validating || !couponInput.trim()}>
                      {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                  {couponMsg && <p className="text-xs text-destructive">{couponMsg}</p>}
                </div>
              )}
            </section>

            <section className="card-elevated p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2"><Wallet className="h-4 w-4" /> Payment method</h2>
              <div className="rounded-lg border border-primary bg-accent/40 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Wallet balance</div>
                    <div className="text-xs text-muted-foreground">Funds debited instantly on checkout</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{balance === null ? "—" : inr(balance)}</div>
                  </div>
                </div>
                {insufficient && (
                  <div className="mt-4 rounded-md bg-destructive/10 text-destructive text-sm p-3 flex items-center justify-between gap-3">
                    <span>Insufficient balance. You need {inr(total - (balance ?? 0))} more.</span>
                    <Button size="sm" variant="outline" asChild><Link to="/buyer">Add funds</Link></Button>
                  </div>
                )}
              </div>
              {settings?.upi_id && (
                <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
                  <CreditCard className="h-3 w-3" /> Top up via UPI: <code className="text-foreground font-mono">{settings.upi_id}</code>
                </p>
              )}
            </section>
          </div>

          <aside>
            <div className="card-elevated p-6 sticky top-24 space-y-4">
              <h2 className="font-semibold">Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-primary"><span>Coupon ({couponCode})</span><span>− {inr(couponDiscount)}</span></div>
                )}
                <div className="flex justify-between text-muted-foreground"><span>Fees</span><span className="text-primary">Free</span></div>
                <div className="border-t border-border pt-3 flex justify-between font-bold text-base">
                  <span>Total</span><span>{inr(total)}</span>
                </div>
              </div>
              <Button className="w-full" size="lg" onClick={placeOrder} disabled={processing || insufficient || balance === null}>
                {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing…</> : <>Pay {inr(total)} <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
                <Lock className="h-3 w-3" /> 256-bit secure checkout
              </p>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Checkout;
