import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gift, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "sc_exit_intent_seen_v1";
const COUPON = "WELCOME10";

export const ExitIntentPopup = () => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    let armed = false;
    const arm = setTimeout(() => { armed = true; }, 8000); // 8s grace period

    const onLeave = (e: MouseEvent) => {
      if (!armed) return;
      // Trigger when cursor exits via the top of viewport
      if (e.clientY <= 0) {
        setOpen(true);
        localStorage.setItem(STORAGE_KEY, "1");
        document.removeEventListener("mouseout", onLeave);
      }
    };

    // Mobile fallback: trigger on tab visibility change after grace
    const onVis = () => {
      if (!armed || document.visibilityState !== "hidden") return;
      setOpen(true);
      localStorage.setItem(STORAGE_KEY, "1");
      document.removeEventListener("visibilitychange", onVis);
    };

    document.addEventListener("mouseout", onLeave);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(arm);
      document.removeEventListener("mouseout", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(COUPON);
      setCopied(true);
      toast.success("Coupon copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Code: " + COUPON);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md text-center p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-background p-6 pt-8">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/15 text-primary flex items-center justify-center mb-3">
            <Gift className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold">Wait — here's 10% off!</h2>
          <p className="text-sm text-muted-foreground mt-1.5 px-2">
            Apply this coupon at checkout and save on your first order.
          </p>

          <button
            onClick={copy}
            className="mt-5 mx-auto flex items-center justify-between gap-3 px-4 py-3 w-full max-w-xs rounded-xl border-2 border-dashed border-primary/40 bg-card hover:bg-accent transition"
          >
            <span className="font-mono text-lg font-bold tracking-widest text-primary">{COUPON}</span>
            {copied ? <Check className="h-5 w-5 text-primary" /> : <Copy className="h-5 w-5 text-muted-foreground" />}
          </button>

          <div className="mt-5 flex flex-col gap-2">
            <Button asChild size="lg" className="rounded-xl">
              <Link to="/browse" onClick={() => setOpen(false)}>Shop now</Link>
            </Button>
            <button
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              No thanks, I'll pay full price
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
