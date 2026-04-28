import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/format";
import { Clock, CheckCircle2, XCircle, ArrowRight, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function PendingOrder() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [po, setPo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
    return () => { supabase.removeChannel(channel); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

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

  const status = po.status as "pending" | "approved" | "rejected";
  const items = (po.items as any[]) || [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-8 md:py-10 max-w-2xl">
        <div className="card-elevated p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1 className="text-2xl font-bold">Payment status</h1>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
          </div>

          {status === "pending" && (
            <div className="rounded-lg bg-warning/10 border border-warning/30 p-5 text-center space-y-3">
              <Clock className="h-12 w-12 mx-auto text-warning" />
              <div className="font-semibold text-lg">Waiting for verification</div>
              <p className="text-sm text-muted-foreground">
                We're verifying your payment. This usually takes <strong>5–10 minutes</strong>. You'll see your credentials here once approved — no need to refresh.
              </p>
            </div>
          )}

          {status === "approved" && (
            <div className="rounded-lg bg-primary/10 border border-primary/30 p-5 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
              <div className="font-semibold text-lg">Payment approved!</div>
              <p className="text-sm text-muted-foreground">Your credentials have been delivered.</p>
              {po.order_ids && po.order_ids.length > 0 && (
                <Button asChild>
                  <Link to={`/success?ids=${po.order_ids.join(",")}`}>View credentials <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
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

          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Reference ID</span><code className="text-xs">{po.id.slice(0, 8)}</code></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{inr(Number(po.amount))}</span></div>
            {po.upi_reference && <div className="flex justify-between text-sm"><span className="text-muted-foreground">UPI ref</span><code className="text-xs">{po.upi_reference}</code></div>}
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Status</span>
              <Badge variant={status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary"}>{status}</Badge>
            </div>
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
