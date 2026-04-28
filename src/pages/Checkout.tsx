import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Lock, Wallet, ArrowRight, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";

const Checkout = () => {
  const { items, subtotal, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    document.title = "Checkout — StreamCart";
    if (!user) { navigate("/auth?next=/checkout"); return; }
    if (items.length === 0) { navigate("/cart"); return; }
    supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setBalance(Number(data?.balance ?? 0)));
  }, [user, items.length, navigate]);

  const insufficient = balance !== null && balance < subtotal;

  const placeOrder = async () => {
    if (!user || items.length === 0) return;
    setProcessing(true);
    const orderIds: string[] = [];
    try {
      // Process each item × qty as separate purchases via the existing RPC
      for (const it of items) {
        for (let i = 0; i < it.qty; i++) {
          const { data, error } = await supabase.rpc("purchase_product", { _product_id: it.id });
          if (error) throw error;
          if (data) orderIds.push(data as string);
        }
      }
      clear();
      toast.success("Order placed! Credentials are ready.");
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
                    <span>Insufficient balance. You need {inr(subtotal - (balance ?? 0))} more.</span>
                    <Button size="sm" variant="outline" asChild><Link to="/buyer">Add funds</Link></Button>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside>
            <div className="card-elevated p-6 sticky top-24 space-y-4">
              <h2 className="font-semibold">Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Fees</span><span className="text-primary">Free</span></div>
                <div className="border-t border-border pt-3 flex justify-between font-bold text-base">
                  <span>Total</span><span>{inr(subtotal)}</span>
                </div>
              </div>
              <Button className="w-full" size="lg" onClick={placeOrder} disabled={processing || insufficient || balance === null}>
                {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing…</> : <>Pay {inr(subtotal)} <ArrowRight className="ml-2 h-4 w-4" /></>}
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
