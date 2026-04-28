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
import { Loader2, Wallet, ArrowRight, ShoppingBag, TicketPercent, X, CheckCircle2, Smartphone, Upload, Clock, ShieldCheck, Copy } from "lucide-react";
import { Link } from "react-router-dom";

type Settings = { upi_id: string; commission_percent: number };

const Checkout = () => {
  const { items, subtotal, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);

  // Coupon
  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  // Manual UPI
  const [txnId, setTxnId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Unique amount with random paise (0.01–0.99) — generated once per checkout session
  const [amountSuffix] = useState<number>(() => {
    // 1..99 paise → 0.01..0.99
    return Math.floor(Math.random() * 99) + 1;
  });

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

  const baseTotal = Math.max(0, subtotal - couponDiscount);
  // Unique payable: base + paise suffix (only when base > 0)
  const uniqueAmount = baseTotal > 0
    ? Math.round((baseTotal + amountSuffix / 100) * 100) / 100
    : 0;
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

  const submitManualUpi = async () => {
    if (!user) return;
    if (!file) return toast.error("Please upload your payment screenshot");
    if (file.size > 5 * 1024 * 1024) return toast.error("Screenshot must be under 5 MB");
    setProcessing(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("payment-screenshots").upload(path, file);
      if (up.error) throw up.error;
      const affSlug = (await import("@/lib/refTracking")).getStoredAffSlug();
      const { data, error } = await supabase.from("pending_orders").insert({
        buyer_id: user.id,
        amount: total,
        upi_reference: upiRef.trim() || null,
        screenshot_path: path,
        items: items.map((i) => ({ id: i.id, qty: i.qty, service_name: i.service_name, display_price: i.display_price })),
        coupon_code: couponCode,
        affiliate_slug: affSlug,
      }).select("id").single();
      if (error) throw error;
      clear();
      toast.success("Payment submitted! We'll verify in 5–10 minutes.");
      navigate(`/orders/pending/${data.id}`);
    } catch (err: any) {
      toast.error(err.message || "Could not submit payment");
    } finally { setProcessing(false); }
  };

  const upiId = settings?.upi_id || "streamcart@upi";
  const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent("StreamCart")}&am=${total}&cu=INR&tn=${encodeURIComponent(`Order ${user?.id?.slice(0, 8)}`)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiLink)}`;

  const copyUpi = () => { navigator.clipboard.writeText(upiId); toast.success("UPI ID copied"); };

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

              {/* Wallet (if sufficient) */}
              {canPayWallet && (
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

              {/* Manual UPI */}
              <div className="rounded-lg border border-border p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  <div className="font-semibold">Pay via UPI {canPayWallet && <span className="text-xs text-muted-foreground font-normal">(alternative)</span>}</div>
                </div>

                {/* Instructions */}
                <ol className="text-sm space-y-1.5 text-muted-foreground list-decimal pl-5">
                  <li>Pay <span className="text-foreground font-semibold">{inr(total)}</span> to the UPI ID or scan the QR</li>
                  <li>Take a screenshot of the successful payment</li>
                  <li>Upload it below — we verify in <span className="text-foreground font-medium">5–10 minutes</span></li>
                  <li>Credentials delivered instantly after approval</li>
                </ol>

                <div className="grid sm:grid-cols-2 gap-4 items-start">
                  <div className="rounded-lg bg-muted p-4 text-center">
                    <img src={qrUrl} alt="UPI QR code" className="mx-auto rounded-md bg-background p-2" width={200} height={200} loading="lazy" />
                    <div className="text-xs text-muted-foreground mt-2">Scan with any UPI app</div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">UPI ID</Label>
                      <div className="flex gap-2 mt-1">
                        <code className="flex-1 px-3 py-2 rounded-md bg-muted font-mono text-sm break-all">{upiId}</code>
                        <Button type="button" size="icon" variant="outline" onClick={copyUpi}><Copy className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Amount</Label>
                      <div className="px-3 py-2 rounded-md bg-muted font-mono text-base font-bold mt-1">{inr(total)}</div>
                    </div>
                    <Button type="button" variant="outline" className="w-full" asChild>
                      <a href={upiLink}>Open in UPI app</a>
                    </Button>
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <div>
                    <Label htmlFor="ref" className="text-sm">UPI reference / txn ID <span className="text-muted-foreground">(optional)</span></Label>
                    <Input id="ref" value={upiRef} onChange={(e) => setUpiRef(e.target.value)} maxLength={100} placeholder="e.g. 4123876543210" className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="file" className="text-sm">Payment screenshot <span className="text-destructive">*</span></Label>
                    <Input id="file" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1.5" />
                    {file && <p className="text-xs text-muted-foreground mt-1">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>}
                  </div>
                  <Button className="w-full" size="lg" onClick={submitManualUpi} disabled={processing || !file || total <= 0}>
                    {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</> : <><Upload className="h-4 w-4 mr-2" />Submit payment for verification</>}
                  </Button>
                  <div className="rounded-md bg-warning/10 text-foreground text-xs p-3 flex gap-2 items-start">
                    <Clock className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
                    <span>After payment, please upload the screenshot for verification. It usually takes <strong>5–10 minutes</strong>. You'll receive credentials in your dashboard once approved.</span>
                  </div>
                </div>
              </div>

              {!canPayWallet && balance !== null && balance > 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  Wallet balance ({inr(balance)}) is below total. <Link to="/buyer" className="text-primary hover:underline">Top up</Link> or pay via UPI above.
                </p>
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
