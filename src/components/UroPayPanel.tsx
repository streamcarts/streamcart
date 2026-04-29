import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Zap, CheckCircle2, Sparkles, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import { toast } from "sonner";

type Props = {
  purpose: "checkout" | "topup";
  amount: number;
  customerName?: string;
  // checkout-only
  items?: Array<{ id: string; qty: number; service_name: string; display_price: number }>;
  couponCode?: string | null;
  affiliateSlug?: string | null;
  onCompleted: (result: { status: string; result_ids: any }) => void;
};

type Intent = { uropay_order_id: string; upi_string: string; qr_code: string; amount_rupees: string };

export function UroPayPanel({ purpose, amount, customerName, items, couponCode, affiliateSlug, onCompleted }: Props) {
  const [creating, setCreating] = useState(false);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [refNum, setRefNum] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    // Reset intent if amount changes (e.g. coupon applied)
    setIntent(null);
    setRefNum("");
  }, [amount, couponCode]);

  const createIntent = async () => {
    if (!amount || amount < 1) { toast.error("Invalid amount"); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("uropay-create", {
        body: {
          purpose,
          amount,
          items,
          coupon_code: couponCode ?? null,
          affiliate_slug: affiliateSlug ?? null,
          customer_name: customerName ?? "Customer",
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setIntent(data as Intent);
    } catch (err: any) {
      toast.error(err.message || "Could not generate UroPay QR");
    } finally { setCreating(false); }
  };

  const confirm = async () => {
    if (!intent) return;
    if (!refNum.trim() || refNum.trim().length < 6) return toast.error("Enter the UPI Reference Number (UTR)");
    setConfirming(true);
    try {
      const { data, error } = await supabase.functions.invoke("uropay-confirm", {
        body: { uropay_order_id: intent.uropay_order_id, reference_number: refNum.trim() },
      });
      if (error) throw error;
      const res = data as { status: string; result_ids: any };
      if ((data as any)?.error) throw new Error((data as any).error);
      if (res.status === "completed") {
        toast.success(purpose === "topup" ? "Wallet credited!" : "Payment verified — order placed!");
        onCompleted(res);
      } else {
        toast.message("Payment received — verifying. We'll confirm shortly.");
        onCompleted(res);
      }
    } catch (err: any) {
      toast.error(err.message || "Could not verify payment");
    } finally { setConfirming(false); }
  };

  if (!intent) {
    return (
      <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent p-5 text-center space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 text-primary text-xs font-semibold px-3 py-1">
          <Sparkles className="h-3.5 w-3.5" /> Recommended • Instant verification
        </div>
        <h3 className="font-bold text-lg">UroPay — Auto Verified UPI</h3>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Generate a secure QR — pay any amount, enter your UTR, done. No screenshot needed.
        </p>
        <Button className="w-full" size="lg" onClick={createIntent} disabled={creating || amount < 1}>
          {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating QR…</> : <><Zap className="h-4 w-4 mr-2" />Pay {inr(amount)} via UroPay</>}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-primary/40 bg-card overflow-hidden">
      <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-semibold text-sm">UroPay Secure Payment</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Auto-verified</div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={createIntent} disabled={creating} title="Regenerate">
          <RefreshCw className={`h-3.5 w-3.5 ${creating ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-0">
        <div className="p-5 bg-gradient-to-b from-background to-muted/20 md:border-r border-border space-y-3 text-center">
          <div className="rounded-xl bg-white border-2 border-primary/30 p-3 inline-block shadow-md">
            <img src={intent.qr_code} alt="UroPay UPI QR" width={200} height={200} className="rounded-md" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Pay exactly</div>
            <div className="text-3xl font-bold text-primary font-mono">{inr(Number(intent.amount_rupees))}</div>
          </div>
          <Button variant="outline" className="w-full" asChild>
            <a href={intent.upi_string}><Zap className="h-4 w-4 mr-2" />Open in UPI app</a>
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <ol className="space-y-2 text-sm">
            {[
              "Scan QR with any UPI app",
              <>Pay <span className="text-primary font-bold">exactly {inr(Number(intent.amount_rupees))}</span></>,
              "Copy the UTR / Reference Number from receipt",
              "Paste below & submit — auto-verified",
            ].map((s, i) => (
              <li key={i} className="flex gap-2.5">
                <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                <span className="text-muted-foreground">{s}</span>
              </li>
            ))}
          </ol>

          <div className="border-t border-border pt-3 space-y-2">
            <Label htmlFor="utr" className="text-sm font-medium">UPI Reference / UTR <span className="text-destructive">*</span></Label>
            <Input id="utr" value={refNum} onChange={(e) => setRefNum(e.target.value.replace(/\s/g, ""))}
              maxLength={32} placeholder="e.g. 412387654321" className="font-mono" />
            <Button className="w-full" size="lg" onClick={confirm} disabled={confirming || !refNum.trim()}>
              {confirming ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying…</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Verify & Complete</>}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">Verification usually takes 2–5 seconds.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
