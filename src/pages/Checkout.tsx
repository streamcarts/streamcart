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
import { Loader2, Wallet, ArrowRight, ShoppingBag, TicketPercent, X, CheckCircle2, ShieldCheck, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { RazorpayButton } from "@/components/RazorpayButton";

const Checkout = () => {
  const { items, subtotal, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);

  // Coupon
  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  const loadBalance = async () => {
    if (!user) return;
    const { data } = await supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
    setBalance(Number(data?.balance ?? 0));
  };

  useEffect(() => {
    document.title = "Checkout — StreamCart";
    if (!user) { navigate("/auth?next=/checkout"); return; }
    if (items.length === 0) { navigate("/cart"); return; }
    loadBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, items.length, navigate]);

  const baseTotal = Math.max(0, subtotal - couponDiscount);
  const total = baseTotal;
  const canPayWallet = balance !== null && balance >= total;

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
        setCouponCode(null); setCouponDiscount(0);
        setCouponMsg(row?.message ?? "Invalid coupon");
        toast.error(row?.message ?? "Invalid coupon");
        return;
      }
      setCouponCode(code);
      setCouponDiscount(Number(row.discount));
      setCouponMsg(`Coupon applied — you save ${inr(Number(row.discount))}`);
      toast.success(`Saved ${inr(Number(row.discount))}`);
    } catch (err: any) {
      toast.error(err.message ?? "Could not validate");
    } finally { setValidating(false); }
  };

  const removeCoupon = () => { setCouponCode(null); setCouponDiscount(0); setCouponInput(""); setCouponMsg(null); };

  const payFromWallet = async () => {
    if (!user || items.length === 0) return;
    setProcessing(true);
    const orderIds: string[] = [];
    let appliedOnce = false;
    const affSlug = (await import("@/lib/refTracking")).getStoredAffSlug();
    try {
      for (const it of items) {
        for (let i = 0; i < it.qty; i++) {
          const args: any = { _product_id: it.id };
          if (couponCode && !appliedOnce) { args._coupon_code = couponCode; appliedOnce = true; }
          if (affSlug) args._affiliate_slug = affSlug;
          const { data, error } = await supabase.rpc("purchase_product", args);
          if (error) throw error;
          if (data) orderIds.push(data as string);
        }
      }
      clear();
      toast.success(`Order placed! ${orderIds.length} item${orderIds.length > 1 ? "s" : ""} delivered.`);
      navigate(`/success?ids=${orderIds.join(",")}`);
    } catch (err: any) {
      toast.error(err.message || "Checkout failed");
    } finally { setProcessing(false); }
  };

  if (!user || items.length === 0) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-8 md:py-10 max-w-5xl">
        <h1 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8">Checkout</h1>
        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Items */}
            <section className="card-elevated p-5 md:p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> Order items</h2>
              <div className="space-y-2">
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
            <section className="card-elevated p-5 md:p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2"><TicketPercent className="h-4 w-4" /> Have a coupon?</h2>
              {couponCode ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span><Badge className="mr-2">{couponCode}</Badge>{couponMsg}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={removeCoupon}><X className="h-4 w-4 mr-1" />Remove</Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input placeholder="Enter coupon code" value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())} maxLength={32}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } }} />
                  <Button onClick={applyCoupon} disabled={validating || !couponInput.trim()}>
                    {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                  </Button>
                </div>
              )}
              {couponMsg && !couponCode && <p className="text-xs text-destructive mt-2">{couponMsg}</p>}
            </section>

            {/* Payment method */}
            <section className="card-elevated p-5 md:p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2"><Wallet className="h-4 w-4" /> Payment method</h2>

              {/* 100% off — free checkout */}
              {total === 0 && (
                <div className="rounded-lg border border-primary bg-primary/5 p-4 mb-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="font-semibold flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> 100% off applied</div>
                      <div className="text-xs text-muted-foreground">No payment required — confirm to place order instantly</div>
                    </div>
                    <div className="text-2xl font-bold text-primary">{inr(0)}</div>
                  </div>
                  <Button className="w-full mt-3" onClick={payFromWallet} disabled={processing}>
                    {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Confirming…</> : <>Confirm free order <ArrowRight className="ml-2 h-4 w-4" /></>}
                  </Button>
                </div>
              )}

              {/* Wallet (if sufficient) */}
              {total > 0 && canPayWallet && (
                <div className="rounded-lg border border-primary bg-primary/5 p-4 mb-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="font-semibold flex items-center gap-2"><Wallet className="h-4 w-4" /> Wallet balance</div>
                      <div className="text-xs text-muted-foreground">Instant delivery — no verification needed</div>
                    </div>
                    <div className="text-2xl font-bold">{inr(balance!)}</div>
                  </div>
                  <Button className="w-full mt-3" onClick={payFromWallet} disabled={processing}>
                    {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing…</> : <>Pay {inr(total)} from wallet <ArrowRight className="ml-2 h-4 w-4" /></>}
                  </Button>
                </div>
              )}

              {/* Razorpay payment (only when wallet is short / not used) */}
              {total > 0 && !canPayWallet && (
                <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
                  <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border px-5 py-4 flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold leading-tight">Pay with Razorpay</div>
                      <div className="text-[11px] text-muted-foreground">UPI · Cards · Netbanking · Wallets — fully automated</div>
                    </div>
                    <Badge variant="outline" className="hidden sm:inline-flex">Instant</Badge>
                  </div>
                  <div className="p-5 md:p-6 space-y-4">
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wide">Amount payable</div>
                        <div className="text-3xl font-bold text-primary font-mono">{inr(total)}</div>
                      </div>
                      <div className="text-xs text-muted-foreground max-w-xs">
                        Pay → wallet credited instantly → order placed automatically. No manual approval.
                      </div>
                    </div>
                    <RazorpayButton
                      amount={total}
                      purpose="topup"
                      userEmail={user?.email}
                      description={`StreamCart order — ${items.length} item${items.length > 1 ? "s" : ""}`}
                      label={`Pay ${inr(total)} securely`}
                      onSuccess={async () => {
                        // Wallet just got credited — auto-place the order
                        await payFromWallet();
                      }}
                    />
                    <div className="text-[11px] text-muted-foreground text-center">
                      <ShieldCheck className="h-3 w-3 inline mr-1" />
                      Signature-verified payments • PCI-DSS compliant • No fake confirmations
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          <aside>
            <div className="card-elevated p-5 md:p-6 lg:sticky lg:top-24 space-y-4">
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
              <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1.5 pt-2 border-t border-border">
                <ShieldCheck className="h-3.5 w-3.5" /> Manual verification — no fake auto-confirmation
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
