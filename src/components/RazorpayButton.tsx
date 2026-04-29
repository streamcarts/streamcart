import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Zap } from "lucide-react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

const loadScript = () =>
  new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

type Props = {
  amount: number; // INR
  purpose?: "topup" | "checkout";
  userEmail?: string | null;
  userName?: string | null;
  description?: string;
  disabled?: boolean;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  label?: string;
  onSuccess?: () => void; // called after server-verified
};

export const RazorpayButton = ({
  amount,
  purpose = "topup",
  userEmail,
  userName,
  description = "StreamCart payment",
  disabled,
  className,
  size = "lg",
  label,
  onSuccess,
}: Props) => {
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    if (!Number.isFinite(amount) || amount < 1) {
      return toast.error("Invalid amount");
    }
    setBusy(true);
    try {
      const ok = await loadScript();
      if (!ok) throw new Error("Razorpay SDK failed to load. Check connection.");

      const { data, error } = await supabase.functions.invoke("razorpay-create-order", {
        body: { amount, purpose },
      });
      if (error || !data?.order_id) {
        throw new Error(error?.message || data?.error || "Could not create order");
      }

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: data.key_id,
          amount: data.amount,
          currency: data.currency,
          name: "StreamCart",
          description,
          order_id: data.order_id,
          prefill: {
            email: userEmail || undefined,
            name: userName || undefined,
          },
          theme: { color: "#6366f1" },
          modal: {
            ondismiss: () => {
              setBusy(false);
              reject(new Error("dismissed"));
            },
          },
          handler: async (resp: any) => {
            try {
              const { data: vData, error: vErr } = await supabase.functions.invoke(
                "razorpay-verify",
                {
                  body: {
                    razorpay_order_id: resp.razorpay_order_id,
                    razorpay_payment_id: resp.razorpay_payment_id,
                    razorpay_signature: resp.razorpay_signature,
                  },
                },
              );
              if (vErr || !vData?.ok) {
                throw new Error(vErr?.message || vData?.error || "Verification failed");
              }
              toast.success("Payment verified! ₹" + amount + " credited.");
              onSuccess?.();
              resolve();
            } catch (err: any) {
              toast.error(err.message || "Verification failed");
              reject(err);
            } finally {
              setBusy(false);
            }
          },
        });
        rzp.on("payment.failed", (resp: any) => {
          toast.error(resp?.error?.description || "Payment failed");
          setBusy(false);
          reject(new Error("failed"));
        });
        rzp.open();
      }).catch((e) => {
        if ((e as Error).message !== "dismissed") {
          // already toasted
        }
      });
    } catch (err: any) {
      toast.error(err.message || "Payment could not start");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size={size}
        className={className ?? "w-full bg-gradient-to-r from-primary to-primary/80"}
        onClick={pay}
        disabled={disabled || busy}
      >
        {busy ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Opening Razorpay…</>
        ) : (
          <><Zap className="h-4 w-4 mr-2" />{label ?? `Pay ₹${amount} now`}</>
        )}
      </Button>
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3 w-3" /> Secure payment powered by Razorpay
      </div>
    </div>
  );
};

export default RazorpayButton;
