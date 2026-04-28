import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Plus, Wallet } from "lucide-react";

type Order = {
  id: string;
  service_name: string;
  total_paid: number;
  credentials_email: string;
  credentials_password: string;
  status: string;
  created_at: string;
};

type Topup = { id: string; amount: number; status: string; created_at: string };

const Buyer = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [topups, setTopups] = useState<Topup[]>([]);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [amount, setAmount] = useState("");
  const [upiRef, setUpiRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => { document.title = "Buyer dashboard — StreamCart"; }, []);
  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    const [w, o, t] = await Promise.all([
      supabase.from("wallets").select("balance").eq("user_id", user!.id).maybeSingle(),
      supabase.from("orders").select("*").eq("buyer_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("wallet_topups").select("id,amount,status,created_at").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(10),
    ]);
    setBalance(Number(w.data?.balance ?? 0));
    setOrders((o.data as Order[]) ?? []);
    setTopups((t.data as Topup[]) ?? []);
  };

  const submitTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    if (!file) return toast.error("Please attach a UPI screenshot");
    if (file.size > 5 * 1024 * 1024) return toast.error("File too large (max 5MB)");
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user!.id}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("topup-screenshots").upload(path, file);
      if (up.error) throw up.error;
      const { error } = await supabase.from("wallet_topups").insert({
        user_id: user!.id, amount: amt, upi_reference: upiRef.trim() || null, screenshot_path: path,
      });
      if (error) throw error;
      toast.success("Top-up submitted! Admin will approve shortly.");
      setAmount(""); setUpiRef(""); setFile(null); setOpen(false);
      load();
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Buyer dashboard</h1>
          <p className="text-muted-foreground">Wallet, orders, and credentials.</p>
        </div>

        {/* Wallet */}
        <Card className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-accent text-accent-foreground flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Wallet balance</div>
              <div className="text-3xl font-bold">{inr(balance)}</div>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Add funds</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add funds via UPI</DialogTitle></DialogHeader>
              <form onSubmit={submitTopup} className="space-y-4">
                <div className="rounded-lg bg-muted p-4 text-sm">
                  <div className="font-semibold mb-1">Pay to UPI:</div>
                  <code className="text-primary font-mono">streamcart@upi</code>
                  <p className="text-muted-foreground mt-2 text-xs">After paying, upload the screenshot below. Admin will credit your wallet within minutes.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="amt">Amount (₹)</Label>
                  <Input id="amt" type="number" step="0.01" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ref">UPI reference / txn ID (optional)</Label>
                  <Input id="ref" value={upiRef} onChange={(e) => setUpiRef(e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="file">Payment screenshot</Label>
                  <Input id="file" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit top-up
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </Card>

        {/* Recent topups */}
        {topups.length > 0 && (
          <Card className="p-6">
            <h2 className="font-semibold mb-4">Recent top-ups</h2>
            <div className="space-y-2">
              {topups.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                  <span>{inr(t.amount)}</span>
                  <span className="text-muted-foreground text-xs">{new Date(t.created_at).toLocaleString()}</span>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Orders */}
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Order history</h2>
          {orders.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">No orders yet.</div>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <div key={o.id} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="font-semibold">{o.service_name}</div>
                      <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
                    </div>
                    <div className="font-bold text-primary">{inr(o.total_paid)}</div>
                  </div>
                  <div className="mt-3 rounded-md bg-muted p-3">
                    {revealed[o.id] ? (
                      <div className="font-mono text-sm space-y-1">
                        <div><span className="text-muted-foreground">Email: </span>{o.credentials_email}</div>
                        <div><span className="text-muted-foreground">Password: </span>{o.credentials_password}</div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">Credentials hidden</div>
                    )}
                    <Button size="sm" variant="ghost" className="mt-2" onClick={() => setRevealed({ ...revealed, [o.id]: !revealed[o.id] })}>
                      {revealed[o.id] ? <><EyeOff className="h-4 w-4 mr-1.5" />Hide</> : <><Eye className="h-4 w-4 mr-1.5" />Reveal credentials</>}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
      <Footer />
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const v = status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary";
  return <Badge variant={v as any} className="capitalize">{status}</Badge>;
};

export default Buyer;
