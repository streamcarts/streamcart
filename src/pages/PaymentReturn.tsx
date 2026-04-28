import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

export default function PaymentReturn() {
  const [params] = useSearchParams();
  const intentId = params.get("intent");
  const [status, setStatus] = useState<"pending" | "paid" | "failed" | "expired" | "loading">("loading");
  const [purpose, setPurpose] = useState<string>("");

  useEffect(() => {
    if (!intentId) { setStatus("failed"); return; }
    let cancelled = false;
    let tries = 0;
    const poll = async () => {
      const { data } = await supabase.from("payment_intents").select("status,purpose").eq("id", intentId).maybeSingle();
      if (cancelled) return;
      if (data) {
        setPurpose(data.purpose);
        if (data.status === "paid" || data.status === "failed" || data.status === "expired") {
          setStatus(data.status);
          return;
        }
        setStatus("pending");
      }
      tries++;
      if (tries < 20) setTimeout(poll, 2000);
    };
    poll();
    return () => { cancelled = true; };
  }, [intentId]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <Card className="p-8 max-w-md w-full text-center space-y-4">
        {status === "loading" || status === "pending" ? (
          <>
            <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
            <h1 className="text-2xl font-bold">Confirming payment…</h1>
            <p className="text-muted-foreground text-sm">This usually takes a few seconds. Please don't close this page.</p>
          </>
        ) : status === "paid" ? (
          <>
            <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
            <h1 className="text-2xl font-bold">Payment successful</h1>
            <p className="text-muted-foreground">{purpose === "topup" ? "Your wallet has been credited." : "Order confirmed."}</p>
            <Button asChild className="w-full"><Link to="/buyer">Go to dashboard</Link></Button>
          </>
        ) : (
          <>
            <XCircle className="h-12 w-12 mx-auto text-destructive" />
            <h1 className="text-2xl font-bold">Payment {status}</h1>
            <p className="text-muted-foreground">No money was deducted, or it will auto-refund. Try again or contact support.</p>
            <Button asChild variant="outline" className="w-full"><Link to="/buyer">Back to dashboard</Link></Button>
          </>
        )}
      </Card>
    </div>
  );
}
