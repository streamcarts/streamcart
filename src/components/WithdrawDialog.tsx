import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Banknote, Upload, CheckCircle2, Clock } from "lucide-react";
import { inr } from "@/lib/format";

interface Props {
  balance: number;
  userId: string;
  onDone: () => void;
  triggerLabel?: string;
}

export const WithdrawDialog = ({ balance, userId, onDone, triggerLabel }: Props) => {
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState("");
  const [upi, setUpi] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<{ amount: number; upi: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = parseFloat(amt);
    if (!a || a <= 0) return toast.error("Enter a valid amount");
    if (a > balance) return toast.error("Amount exceeds available balance");
    if (!upi.trim()) return toast.error("UPI ID required");
    if (!file) return toast.error("Please upload your UPI QR screenshot");

    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${userId}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("withdrawal-qrs").upload(path, file, { upsert: false });
      if (up.error) throw up.error;

      const { error } = await supabase.rpc("request_withdrawal", {
        _amount: a,
        _upi_id: upi.trim(),
        _qr_path: path,
      });
      if (error) throw error;

      const submittedUpi = upi.trim();
      setAmt(""); setUpi(""); setFile(null); setOpen(false);
      setSuccess({ amount: a, upi: submittedUpi });
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to request withdrawal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" disabled={balance <= 0}>
            <Banknote className="h-4 w-4 mr-2" />
            {triggerLabel ?? `Withdraw ${inr(balance)}`}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request withdrawal</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Amount (₹) — available {inr(balance)}</Label>
              <Input
                type="number" step="0.01" min="1" max={balance}
                value={amt} onChange={(e) => setAmt(e.target.value)} required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Your UPI ID</Label>
              <Input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="yourname@bank" required />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Upload className="h-3.5 w-3.5" /> UPI QR screenshot
              </Label>
              <Input
                type="file" accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} required
              />
              <p className="text-[11px] text-muted-foreground">
                Upload a clear screenshot of your UPI QR. Admin will pay to this QR.
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Request payout
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!success} onOpenChange={(o) => !o && setSuccess(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 text-primary grid place-items-center mb-2">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <AlertDialogTitle className="text-center text-xl">Withdrawal request received</AlertDialogTitle>
            <AlertDialogDescription className="text-center space-y-3 pt-1">
              {success && (
                <span className="block text-base font-semibold text-foreground">
                  {inr(success.amount)} → {success.upi}
                </span>
              )}
              <span className="flex items-center justify-center gap-2 rounded-lg bg-primary/5 text-primary py-2.5 px-3 text-sm font-medium">
                <Clock className="h-4 w-4" />
                Payment will arrive in your bank account within 24–48 hours
              </span>
              <span className="block text-xs text-muted-foreground">
                Our team will verify your UPI QR and transfer the amount. You can track the status anytime in your dashboard.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="w-full">Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
