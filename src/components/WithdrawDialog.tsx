import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Banknote, Upload } from "lucide-react";
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

      toast.success("Withdrawal request submitted");
      setAmt(""); setUpi(""); setFile(null); setOpen(false);
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to request withdrawal");
    } finally {
      setBusy(false);
    }
  };

  return (
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
  );
};
