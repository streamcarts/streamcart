import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/format";
import { Clock, CheckCircle2, XCircle, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function PendingOrder() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [po, setPo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const load = async () => {
    if (!id || !user) return;
    const { data } = await supabase.from("pending_orders").select("*").eq("id", id).maybeSingle();
    setPo(data);
    setLoading(false);
  };

  useEffect(() => {
    document.title = "Payment status — StreamCart";
    load();
    const channel = supabase
      .channel(`po-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pending_orders", filter: `id=eq.${id}` }, () => load())
      .subscribe();
    const poll = setInterval(load, 15000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { supabase.removeChannel(channel); clearInterval(poll); clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  const cancelOrder = async () => {
    if (!id) return;
    if (!confirm("Cancel this pending order? You can place a new one anytime.")) return;
    const { error } = await supabase.rpc("cancel_my_pending_order", { _id: id });
    if (error) return toast.error(error.message);
    toast.success("Order cancelled");
    load();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container py-10 max-w-2xl">
          <Skeleton className="h-64 w-full" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!po) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container py-10 max-w-2xl text-center">
          <h1 className="text-2xl font-bold mb-2">Order not found</h1>
          <Button asChild className="mt-4"><Link to="/buyer">Go to dashboard</Link></Button>
        </main>
        <Footer />
      </div>
    );
  }

  const status = po.status as "pending" | "approved" | "rejected" | "expired" | "cancelled";
  const items = (po.items as any[]) || [];
  const expiresAt = po.expires_at ? new Date(po.expires_at).getTime() : null;
  const msLeft = expiresAt ? Math.max(0, expiresAt - now) : 0;
  const minLeft = Math.floor(msLeft / 60000);
  const secLeft = Math.floor((msLeft % 60000) / 1000);
  const isExpired = status === "pending" && expiresAt !== null && msLeft === 0;

  const statusBadge = (() => {
    if (isExpired) return <Badge variant="destructive">expired</Badge>;
    if (status === "approved") return <Badge>approved</Badge>;
    if (status === "rejected") return <Badge variant="destructive">rejected</Badge>;
    if (status === "cancelled" || status === "expired") return <Badge variant="outline">{status}</Badge>;
    return <Badge variant="secondary">pending</Badge>;
  })();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-8 md:py-10 max-w-2xl">
        <div className="card-elevated p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-2xl font-bold">Payment status</h1>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
          </div>

          {status === "pending" && !isExpired && (
            <div className="rounded-lg bg-warning/10 border border-warning/30 p-5 text-center space-y-3">
              <Clock className="h-12 w-12 mx-auto text-warning animate-pulse" />
              <div className="font-semibold text-lg">Waiting for verification</div>
              <p className="text-sm text-muted-foreground">
                We're verifying your payment. This usually takes <strong>5–10 minutes</strong>. Status updates here in real-time — no need to refresh.
              </p>
              {expiresAt && (
                <div className="inline-flex items-center gap-2 rounded-full bg-background border border-border px-3 py-1.5 text-xs font-mono">
                  <Clock className="h-3.5 w-3.5" />
                  Auto-cancels in {String(minLeft).padStart(2, "0")}:{String(secLeft).padStart(2, "0")}
                </div>
              )}
              <div>
                <Button size="sm" variant="ghost" onClick={cancelOrder} className="text-muted-foreground">Cancel order</Button>
              </div>
            </div>
          )}

          {isExpired && (
            <div className="rounded-lg bg-muted border border-border p-5 text-center space-y-3">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
              <div className="font-semibold text-lg">Order expired</div>
              <p className="text-sm text-muted-foreground">This order timed out. Please place a new order if you'd like to try again.</p>
              <Button asChild variant="outline"><Link to="/browse">Browse products</Link></Button>
            </div>
          )}

          {status === "approved" && (
            <div className="rounded-lg bg-primary/10 border border-primary/30 p-5 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
              <div className="font-semibold text-lg">Payment verified!</div>
              <p className="text-sm text-muted-foreground">Chat with the seller to receive your credentials.</p>
              {po.order_ids && po.order_ids.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button asChild>
                    <Link to={`/orders/chat/${po.order_ids[0]}`}>💬 Open chat <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to={`/success?ids=${po.order_ids.join(",")}`}>View order</Link>
                  </Button>
                </div>
              )}
            </div>
          )}

          {status === "rejected" && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-5 text-center space-y-3">
              <XCircle className="h-12 w-12 mx-auto text-destructive" />
              <div className="font-semibold text-lg">Payment rejected</div>
              {po.admin_note && <p className="text-sm text-muted-foreground">Reason: {po.admin_note}</p>}
              <p className="text-xs text-muted-foreground">Contact support if you believe this is a mistake.</p>
              <Button asChild variant="outline"><Link to="/buyer">Back to dashboard</Link></Button>
            </div>
          )}

          {(status === "cancelled" || (status === "expired" && !isExpired)) && (
            <div className="rounded-lg bg-muted border border-border p-5 text-center space-y-3">
              <XCircle className="h-12 w-12 mx-auto text-muted-foreground" />
              <div className="font-semibold text-lg">Order {status}</div>
              <Button asChild variant="outline"><Link to="/browse">Browse products</Link></Button>
            </div>
          )}

          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Reference ID</span><code className="text-xs">{po.id.slice(0, 8)}</code></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount paid</span><span className="font-semibold">{inr(Number(po.amount))}</span></div>
            {po.txn_id && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Transaction ID</span><code className="text-xs font-mono">{po.txn_id}</code></div>}
            <div className="flex justify-between text-sm items-center"><span className="text-muted-foreground">Status</span>{statusBadge}</div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="text-sm font-semibold mb-2">Items ({items.length})</div>
            <div className="space-y-1.5">
              {items.map((it, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{it.service_name} × {it.qty}</span>
                  <span className="text-muted-foreground">{inr(Number(it.display_price) * it.qty)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
