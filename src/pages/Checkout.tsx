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
import { Loader2, Wallet, ArrowRight, ShoppingBag, TicketPercent, X, CheckCircle2, Smartphone, Upload, Clock, ShieldCheck, Copy, QrCode, Zap, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import payGpay from "@/assets/pay-gpay.png";
import payPhonepe from "@/assets/pay-phonepe.png";
import payPaytm from "@/assets/pay-paytm.png";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UroPayPanel } from "@/components/UroPayPanel";

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
    if (!txnId.trim() || txnId.trim().length < 6) return toast.error("Enter the UPI transaction ID (min 6 characters)");
    if (!file) return toast.error("Please upload your payment screenshot");
    if (file.size > 5 * 1024 * 1024) return toast.error("Screenshot must be under 5 MB");
    setProcessing(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("payment-screenshots").upload(path, file);
      if (up.error) throw up.error;
      const affSlug = (await import("@/lib/refTracking")).getStoredAffSlug();
      const { data, error } = await supabase.rpc("submit_pending_order", {
        _amount: uniqueAmount,
        _txn_id: txnId.trim(),
        _screenshot_path: path,
        _items: items.map((i) => ({ id: i.id, qty: i.qty, service_name: i.service_name, display_price: i.display_price })),
        _coupon_code: couponCode,
        _affiliate_slug: affSlug,
        _upi_reference: null,
      });
      if (error) throw error;
      clear();
      // Fire OCR in background — trigger re-scores when done
      supabase.functions.invoke("ocr-payment", { body: { pending_order_id: data } }).catch((e) => console.error("OCR invoke failed", e));
      toast.success("Payment submitted! Verifying — this is usually instant.");
      navigate(`/orders/pending/${data}`);
    } catch (err: any) {
      toast.error(err.message || "Could not submit payment");
    } finally { setProcessing(false); }
  };

  const upiId = settings?.upi_id || "streamcart@upi";
  const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent("StreamCart")}&am=${uniqueAmount}&cu=INR&tn=${encodeURIComponent(`Order ${user?.id?.slice(0, 8)}`)}`;
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

              {/* Premium UPI payment card — hidden when total is 0 */}
              {total > 0 && (
              <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border px-5 py-4 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
                      <Smartphone className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold leading-tight">Pay via UPI</div>
                      <div className="text-[11px] text-muted-foreground">Instant verification • Secure</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/60 rounded-full px-2.5 py-1">
                    <Lock className="h-3 w-3" /> 256-bit secured
                  </div>
                </div>

                {/* Split layout: QR (left) + How-to (right) */}
                <div className="grid md:grid-cols-2 gap-0">
                  {/* LEFT — QR card */}
                  <div className="p-5 md:p-6 bg-gradient-to-b from-background to-muted/30 md:border-r border-border space-y-4">
                    <div className="rounded-xl bg-white border-2 border-primary/20 p-4 shadow-md">
                      <div className="flex items-center justify-center mb-3">
                        <img src={qrUrl} alt="UPI QR code" className="rounded-md" width={200} height={200} loading="lazy" />
                      </div>
                      <div className="text-center border-t border-border pt-3">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Scan & pay exactly</div>
                        <div className="text-3xl font-bold text-primary font-mono mt-0.5">{inr(uniqueAmount)}</div>
                      </div>
                    </div>

                    {/* UPI ID copy */}
                    <div>
                      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">UPI ID</Label>
                      <div className="flex gap-2 mt-1.5">
                        <code className="flex-1 px-3 py-2.5 rounded-lg bg-muted border border-border font-mono text-sm break-all">{upiId}</code>
                        <Button type="button" size="icon" variant="outline" onClick={copyUpi} title="Copy UPI ID"><Copy className="h-4 w-4" /></Button>
                      </div>
                    </div>

                    {/* Supported apps */}
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Pay with any UPI app</div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { name: "GPay", logo: payGpay },
                          { name: "PhonePe", logo: payPhonepe },
                          { name: "Paytm", logo: payPaytm },
                        ].map((app) => (
                          <div key={app.name} className="rounded-lg border border-border bg-background px-2 py-2 flex items-center gap-2">
                            <img src={app.logo} alt={`${app.name} logo`} loading="lazy" className="h-7 w-7 rounded-md object-contain shrink-0" />
                            <span className="text-xs font-medium truncate">{app.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button type="button" variant="outline" className="w-full" asChild>
                      <a href={upiLink}><Zap className="h-4 w-4 mr-2" />Open in UPI app</a>
                    </Button>
                  </div>

                  {/* RIGHT — Steps + proof submission */}
                  <div className="p-5 md:p-6 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <QrCode className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold text-sm">How to pay</h3>
                      </div>
                      <ol className="space-y-2.5">
                        {[
                          "Scan the QR using any UPI app",
                          <>Pay <span className="text-primary font-bold">exactly {inr(uniqueAmount)}</span> (unique amount)</>,
                          "Copy the Transaction ID from the receipt",
                          "Upload screenshot + paste txn ID below",
                        ].map((step, i) => (
                          <li key={i} className="flex gap-2.5 text-sm">
                            <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                            <span className="text-muted-foreground">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div className="border-t border-border pt-4 space-y-3">
                      <div>
                        <Label htmlFor="txn" className="text-sm font-medium">Transaction ID <span className="text-destructive">*</span></Label>
                        <Input id="txn" value={txnId} onChange={(e) => setTxnId(e.target.value)} maxLength={50} placeholder="e.g. 412387654321" className="mt-1.5 font-mono" />
                        <p className="text-[11px] text-muted-foreground mt-1">12-digit UTR from your UPI receipt. One-time use only.</p>
                      </div>
                      <div>
                        <Label htmlFor="file" className="text-sm font-medium">Payment screenshot <span className="text-destructive">*</span></Label>
                        <Input id="file" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1.5" />
                        {file && <p className="text-xs text-primary mt-1 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>}
                      </div>
                      <Button className="w-full" size="lg" onClick={submitManualUpi} disabled={processing || !file || !txnId.trim() || uniqueAmount <= 0}>
                        {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</> : <><Upload className="h-4 w-4 mr-2" />Submit for verification</>}
                      </Button>
                      <div className="rounded-lg bg-primary/5 border border-primary/20 text-xs p-3 flex gap-2 items-start">
                        <Clock className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                        <span>Smart auto-verification in <strong>seconds</strong> when amount + txn ID match. Otherwise reviewed within <strong>5–10 minutes</strong>. Auto-cancels in 10 min if no proof.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}

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
