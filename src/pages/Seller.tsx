import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { inr, calcDisplayPrice } from "@/lib/format";
import { toast } from "sonner";
import { Loader2, Plus, Wallet, Banknote } from "lucide-react";

type Product = {
  id: string; service_name: string; category: string;
  base_price: number; display_price: number; status: string; stock: number;
};
type Order = { id: string; service_name: string; seller_earning: number; created_at: string };
type Withdrawal = { id: string; amount: number; status: string; created_at: string };

const CATS = ["OTT", "AI Tools", "VPN", "SMM", "Other"];

const Seller = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Order[]>([]);
  const [wds, setWds] = useState<Withdrawal[]>([]);
  const [open, setOpen] = useState(false);
  const [wdOpen, setWdOpen] = useState(false);

  // form state
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("OTT");
  const [base, setBase] = useState("");
  const [duration, setDuration] = useState("");
  const [credEmail, setCredEmail] = useState("");
  const [credPwd, setCredPwd] = useState("");
  const [stock, setStock] = useState("1");
  const [busy, setBusy] = useState(false);

  // wd form
  const [wdAmt, setWdAmt] = useState("");
  const [wdUpi, setWdUpi] = useState("");

  useEffect(() => { document.title = "Seller dashboard — StreamCart"; }, []);
  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    const [w, p, o, wd] = await Promise.all([
      supabase.from("wallets").select("balance").eq("user_id", user!.id).maybeSingle(),
      supabase.from("products").select("*").eq("seller_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("orders").select("id,service_name,seller_earning,created_at").eq("seller_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("withdrawals").select("id,amount,status,created_at").eq("seller_id", user!.id).order("created_at", { ascending: false }),
    ]);
    setBalance(Number(w.data?.balance ?? 0));
    setProducts((p.data as Product[]) ?? []);
    setSales((o.data as Order[]) ?? []);
    setWds((wd.data as Withdrawal[]) ?? []);
  };

  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const b = parseFloat(base);
    if (!name.trim() || !b || b <= 0 || !credEmail || !credPwd) return toast.error("Fill required fields");
    setBusy(true);
    const { error } = await supabase.from("products").insert({
      seller_id: user!.id, service_name: name.trim(), description: desc.trim() || null,
      category: cat as any, base_price: b, display_price: calcDisplayPrice(b),
      credentials_email: credEmail.trim(), credentials_password: credPwd,
      duration: duration.trim() || null, stock: parseInt(stock) || 1,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Product submitted for admin review.");
    setName(""); setDesc(""); setBase(""); setCredEmail(""); setCredPwd(""); setDuration(""); setStock("1");
    setOpen(false); load();
  };

  const submitWd = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = parseFloat(wdAmt);
    if (!a || a <= 0) return toast.error("Invalid amount");
    if (a > balance) return toast.error("Amount exceeds balance");
    if (!wdUpi.trim()) return toast.error("UPI ID required");
    const { error } = await supabase.from("withdrawals").insert({ seller_id: user!.id, amount: a, upi_id: wdUpi.trim() });
    if (error) return toast.error(error.message);
    toast.success("Withdrawal requested.");
    setWdAmt(""); setWdUpi(""); setWdOpen(false); load();
  };

  const totalEarned = sales.reduce((s, o) => s + Number(o.seller_earning), 0);
  const previewPrice = parseFloat(base) ? calcDisplayPrice(parseFloat(base)) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Seller dashboard</h1>
          <p className="text-muted-foreground">Earn 90% on every sale.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard icon={<Wallet className="h-5 w-5" />} label="Wallet balance" value={inr(balance)} />
          <StatCard icon={<Banknote className="h-5 w-5" />} label="Total earned" value={inr(totalEarned)} />
          <StatCard icon={<Plus className="h-5 w-5" />} label="Total sales" value={String(sales.length)} />
        </div>

        <div className="flex gap-3 flex-wrap">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add product</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>List a new service</DialogTitle></DialogHeader>
              <form onSubmit={addProduct} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Service name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={cat} onValueChange={setCat}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Duration</Label>
                    <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 1 month" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Base price (₹)</Label>
                    <Input type="number" step="0.01" min="1" value={base} onChange={(e) => setBase(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Display price (auto)</Label>
                    <div className="h-10 px-3 rounded-md border border-border bg-muted flex items-center font-semibold text-primary">
                      {previewPrice ? inr(previewPrice) : "—"}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">+10% StreamCart markup applied automatically. You earn the base price on every sale.</p>
                <div className="space-y-1.5">
                  <Label>Stock</Label>
                  <Input type="number" min="1" value={stock} onChange={(e) => setStock(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Credential email / username</Label>
                  <Input value={credEmail} onChange={(e) => setCredEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Credential password</Label>
                  <Input value={credPwd} onChange={(e) => setCredPwd(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit for review
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={wdOpen} onOpenChange={setWdOpen}>
            <DialogTrigger asChild><Button variant="outline"><Banknote className="h-4 w-4 mr-2" />Request withdrawal</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Request withdrawal</DialogTitle></DialogHeader>
              <form onSubmit={submitWd} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Amount (₹) — available {inr(balance)}</Label>
                  <Input type="number" step="0.01" min="1" max={balance} value={wdAmt} onChange={(e) => setWdAmt(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Your UPI ID</Label>
                  <Input value={wdUpi} onChange={(e) => setWdUpi(e.target.value)} placeholder="yourname@bank" required />
                </div>
                <Button type="submit" className="w-full">Request</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Your products</h2>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No products yet.</p>
          ) : (
            <div className="space-y-2">
              {products.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0">
                  <div>
                    <div className="font-medium">{p.service_name}</div>
                    <div className="text-xs text-muted-foreground">{p.category} • Base {inr(p.base_price)} → Sells at {inr(p.display_price)} • Stock {p.stock}</div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Withdrawal history</h2>
          {wds.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No withdrawals yet.</p>
          ) : (
            <div className="space-y-2">
              {wds.map((w) => (
                <div key={w.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                  <span>{inr(w.amount)}</span>
                  <span className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString()}</span>
                  <StatusBadge status={w.status} />
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

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <Card className="p-5 flex items-center gap-4">
    <div className="h-11 w-11 rounded-xl bg-accent text-accent-foreground flex items-center justify-center">{icon}</div>
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  </Card>
);

const StatusBadge = ({ status }: { status: string }) => {
  const v = status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary";
  return <Badge variant={v as any} className="capitalize">{status}</Badge>;
};

export default Seller;
