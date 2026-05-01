import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "validating" | "ready" | "already" | "invalid" | "submitting" | "done" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("validating");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Unsubscribe — StreamCart";
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
          headers: { apikey: ANON_KEY },
        });
        const data = await r.json();
        if (!r.ok) { setState("invalid"); return; }
        if (data.valid) setState("ready");
        else if (data.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch {
        setState("invalid");
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState("submitting");
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY },
        body: JSON.stringify({ token }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? "Failed"); setState("error"); return; }
      if (data.success) setState("done");
      else if (data.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setState("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold">Email preferences</h1>
        {state === "validating" && (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" /> Checking your link…
          </div>
        )}
        {state === "ready" && (
          <>
            <p className="text-muted-foreground text-sm">Click below to unsubscribe from StreamCart emails.</p>
            <Button onClick={confirm} className="w-full">Confirm unsubscribe</Button>
          </>
        )}
        {state === "submitting" && (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" /> Updating your preferences…
          </div>
        )}
        {state === "done" && (
          <div className="space-y-3">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
            <p className="font-medium">You've been unsubscribed.</p>
            <p className="text-sm text-muted-foreground">You'll no longer receive marketing emails from StreamCart. Important account emails may still be sent.</p>
          </div>
        )}
        {state === "already" && (
          <div className="space-y-3">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
            <p className="font-medium">You're already unsubscribed.</p>
          </div>
        )}
        {(state === "invalid" || state === "error") && (
          <div className="space-y-3">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="font-medium">Link invalid or expired</p>
            {error && <p className="text-xs text-muted-foreground">{error}</p>}
          </div>
        )}
        <div className="pt-2">
          <Button asChild variant="ghost" size="sm"><Link to="/">Back to StreamCart</Link></Button>
        </div>
      </Card>
    </div>
  );
}
