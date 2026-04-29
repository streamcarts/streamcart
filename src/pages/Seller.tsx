import { useEffect, useMemo, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { inr, calcDisplayPrice } from "@/lib/format";
import { toast } from "sonner";
import { Loader2, Plus, Wallet, Banknote, Package, Pencil, Trash2, Key, ShoppingBag, TrendingUp, Star, BarChart3 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";
import { useCategories } from "@/lib/categories";

type Product = {
  id: string; service_name: string; description: string | null; category: string;
  base_price: number; display_price: number; status: string; stock: number;
  is_active: boolean; duration: string | null; avg_rating: number; rating_count: number;
};
type Order = { id: string; service_name: string; seller_earning: number; total_paid: number; created_at: string; buyer_id: string; credentials_email: string };
type Withdrawal = { id: string; amount: number; status: string; created_at: string; upi_id: string };
type Credential = { id: string; product_id: string; cred_email: string; cred_password: string; status: string; created_at: string; assigned_at: string | null };

// Categories now come from product_categories table via useCategories()

const Seller = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Order[]>([]);
  const [wds, setWds] = useState<Withdrawal[]>([]);
  const [creds, setCreds] = useState<Credential[]>([]);

  useEffect(() => { document.title = "Seller dashboard — StreamCart"; }, []);
  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    const [w, p, o, wd, c] = await Promise.all([
      supabase.from("wallets").select("balance").eq("user_id", user!.id).maybeSingle(),
      supabase.from("products").select("*").eq("seller_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("orders").select("id,service_name,seller_earning,total_paid,created_at,buyer_id,credentials_email").eq("seller_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("withdrawals").select("id,amount,status,created_at,upi_id").eq("seller_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("product_credentials").select("id,product_id,cred_email,cred_password,status,created_at,assigned_at").eq("seller_id", user!.id).order("created_at", { ascending: false }),
    ]);
    setBalance(Number(w.data?.balance ?? 0));
    setProducts((p.data as Product[]) ?? []);
    setSales((o.data as Order[]) ?? []);
    setWds((wd.data as Withdrawal[]) ?? []);
    setCreds((c.data as Credential[]) ?? []);
    setLoading(false);
  };

  // ===== Derived metrics =====
  const totalEarned = sales.reduce((s, o) => s + Number(o.seller_earning), 0);
  const totalSlotsSold = sales.length;
  const activeListings = products.filter((p) => p.status === "approved" && p.is_active).length;
  const availableSlots = creds.filter((c) => c.status === "available").length + products.filter(p => !creds.some(c => c.product_id === p.id)).reduce((s, p) => s + (p.stock || 0), 0);

  // 14-day earnings series
  const earningsSeries = useMemo(() => {
    const days: { date: string; label: string; earnings: number; orders: number }[] = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), earnings: 0, orders: 0 });
    }
    sales.forEach((o) => {
      const key = o.created_at.slice(0, 10);
      const day = days.find((d) => d.date === key);
      if (day) { day.earnings += Number(o.seller_earning); day.orders += 1; }
    });
    return days;
  }, [sales]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-10 space-y-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Seller dashboard</h1>
            <p className="text-muted-foreground">Earn 90% on every sale. StreamCart adds a 10% markup automatically.</p>
          </div>
          <WithdrawDialog balance={balance} onDone={load} userId={user!.id} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard loading={loading} icon={<Wallet className="h-5 w-5" />} label="Wallet balance" value={inr(balance)} accent />
          <StatCard loading={loading} icon={<Banknote className="h-5 w-5" />} label="Total earned" value={inr(totalEarned)} />
          <StatCard loading={loading} icon={<ShoppingBag className="h-5 w-5" />} label="Total sales" value={String(totalSlotsSold)} />
          <StatCard loading={loading} icon={<Package className="h-5 w-5" />} label="Active listings" value={`${activeListings} • ${availableSlots} slots`} />
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 max-w-3xl">
            <TabsTrigger value="overview"><BarChart3 className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Overview</span></TabsTrigger>
            <TabsTrigger value="products"><Package className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Products</span></TabsTrigger>
            <TabsTrigger value="credentials"><Key className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Credentials</span></TabsTrigger>
            <TabsTrigger value="orders"><ShoppingBag className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Orders</span></TabsTrigger>
            <TabsTrigger value="payouts"><Banknote className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Payouts</span></TabsTrigger>
          </TabsList>

          {/* ============== OVERVIEW ============== */}
          <TabsContent value="overview" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Earnings (last 14 days)</h2>
                <span className="text-xs text-muted-foreground">{inr(earningsSeries.reduce((s, d) => s + d.earnings, 0))} total</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={earningsSeries} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => inr(v)} />
                    <Line type="monotone" dataKey="earnings" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="font-semibold mb-4">Order trends</h2>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={earningsSeries} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </TabsContent>

          {/* ============== PRODUCTS ============== */}
          <TabsContent value="products" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Your listings</h2>
              <ProductDialog onDone={load} userId={user!.id} />
            </div>
            <ProductsTable products={products} loading={loading} creds={creds} onRefresh={load} userId={user!.id} />
          </TabsContent>

          {/* ============== CREDENTIALS POOL ============== */}
          <TabsContent value="credentials" className="space-y-4">
            <Card className="p-6">
              <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                <div>
                  <h2 className="font-semibold flex items-center gap-2"><Key className="h-4 w-4 text-primary" /> Credential pool</h2>
                  <p className="text-xs text-muted-foreground mt-1">Upload accounts here. They auto-deliver to buyers on purchase. One credential = one slot.</p>
                </div>
                <CredentialDialog products={products} onDone={load} userId={user!.id} />
              </div>
              {loading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : creds.length === 0 ? (
                <EmptyState icon={<Key className="h-8 w-8" />} title="No credentials uploaded" subtitle="Add credentials to enable auto-delivery on purchase." />
              ) : (
                <div className="space-y-2">
                  {creds.map((c) => {
                    const prod = products.find((p) => p.id === c.product_id);
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{prod?.service_name ?? "Unknown product"}</div>
                          <div className="text-xs text-muted-foreground font-mono truncate">{c.cred_email}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={c.status === "available" ? "default" : "secondary"} className="capitalize">{c.status}</Badge>
                          {c.status === "available" && (
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={async () => {
                              const { error } = await supabase.from("product_credentials").delete().eq("id", c.id);
                              if (error) return toast.error(error.message);
                              toast.success("Credential removed");
                              load();
                            }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* ============== ORDERS ============== */}
          <TabsContent value="orders" className="space-y-4">
            <Card className="p-6">
              <h2 className="font-semibold mb-4">Order history</h2>
              {loading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : sales.length === 0 ? (
                <EmptyState icon={<ShoppingBag className="h-8 w-8" />} title="No orders yet" subtitle="Once buyers purchase your products, they'll appear here." />
              ) : (
                <div className="space-y-2">
                  {sales.map((o) => (
                    <div key={o.id} className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{o.service_name}</div>
                        <div className="text-xs text-muted-foreground">#{o.id.slice(0, 8).toUpperCase()} • Delivered: <span className="font-mono">{o.credentials_email}</span></div>
                        <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-primary">{inr(o.seller_earning)}</div>
                        <Badge variant="secondary" className="text-[10px] mt-1">Completed</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* ============== PAYOUTS ============== */}
          <TabsContent value="payouts" className="space-y-4">
            <Card className="p-6">
              <h2 className="font-semibold mb-4">Withdrawal history</h2>
              {loading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : wds.length === 0 ? (
                <EmptyState icon={<Banknote className="h-8 w-8" />} title="No withdrawals yet" subtitle="Request a payout to your UPI ID anytime." />
              ) : (
                <div className="space-y-2">
                  {wds.map((w) => (
                    <div key={w.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0 gap-3">
                      <div className="min-w-0">
                        <div className="font-medium">{inr(w.amount)}</div>
                        <div className="text-xs text-muted-foreground truncate">{w.upi_id} • {new Date(w.created_at).toLocaleString()}</div>
                      </div>
                      <StatusBadge status={w.status} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

// ============= SUB-COMPONENTS =============

const StatCard = ({ icon, label, value, accent, loading }: { icon: React.ReactNode; label: string; value: string; accent?: boolean; loading?: boolean }) => (
  <Card className="p-5 flex items-center gap-3">
    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${accent ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>{icon}</div>
    <div className="min-w-0">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{label}</div>
      {loading ? <Skeleton className="h-7 w-24 mt-1" /> : <div className="text-xl font-bold truncate">{value}</div>}
    </div>
  </Card>
);

const StatusBadge = ({ status }: { status: string }) => {
  const v = status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary";
  return <Badge variant={v as any} className="capitalize">{status}</Badge>;
};

const EmptyState = ({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) => (
  <div className="text-center py-10">
    <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">{icon}</div>
    <p className="font-semibold">{title}</p>
    <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
  </div>
);

// ============= PRODUCTS TABLE =============

const ProductsTable = ({ products, loading, creds, onRefresh, userId }: { products: Product[]; loading: boolean; creds: Credential[]; onRefresh: () => void; userId: string }) => {
  if (loading) return <Card className="p-6 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</Card>;
  if (products.length === 0) return (
    <Card className="p-6"><EmptyState icon={<Package className="h-8 w-8" />} title="No products yet" subtitle="Click 'Add product' to list your first service." /></Card>
  );
  return (
    <div className="space-y-2">
      {products.map((p) => {
        const slotCount = creds.filter(c => c.product_id === p.id && c.status === "available").length || p.stock;
        return (
          <Card key={p.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{p.service_name}</span>
                <Badge variant="outline" className="text-xs">{p.category}</Badge>
                <StatusBadge status={p.status} />
                {p.rating_count > 0 && (
                  <span className="text-xs flex items-center gap-1 text-muted-foreground">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />{Number(p.avg_rating).toFixed(1)} ({p.rating_count})
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Base {inr(p.base_price)} → Sells at {inr(p.display_price)} • {slotCount} slot{slotCount === 1 ? "" : "s"} {slotCount === 0 && <span className="text-destructive font-semibold">SOLD OUT</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 mr-2">
                <Switch checked={p.is_active} onCheckedChange={async (v) => {
                  const { error } = await supabase.from("products").update({ is_active: v }).eq("id", p.id);
                  if (error) return toast.error(error.message);
                  toast.success(v ? "Listing activated" : "Listing paused");
                  onRefresh();
                }} />
                <span className="text-xs text-muted-foreground">{p.is_active ? "Active" : "Paused"}</span>
              </div>
              <ProductDialog product={p} onDone={onRefresh} userId={userId} />
              <DeleteProductButton product={p} onDone={onRefresh} />
            </div>
          </Card>
        );
      })}
    </div>
  );
};

const DeleteProductButton = ({ product, onDone }: { product: Product; onDone: () => void }) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button size="icon" variant="ghost" className="h-8 w-8"><Trash2 className="h-3.5 w-3.5" /></Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete "{product.service_name}"?</AlertDialogTitle>
        <AlertDialogDescription>This permanently removes the product and all its unsold credentials. Existing orders are preserved.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={async () => {
          const { error } = await supabase.from("products").delete().eq("id", product.id);
          if (error) return toast.error(error.message);
          toast.success("Product deleted");
          onDone();
        }}>Delete</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

// ============= PRODUCT DIALOG (Create + Edit) =============

const ProductDialog = ({ product, onDone, userId }: { product?: Product; onDone: () => void; userId: string }) => {
  const editing = !!product;
  const { cats } = useCategories({ activeOnly: true });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(product?.service_name ?? "");
  const [desc, setDesc] = useState(product?.description ?? "");
  const [cat, setCat] = useState(product?.category ?? "OTT");
  const [base, setBase] = useState(product ? String(product.base_price) : "");
  const [duration, setDuration] = useState(product?.duration ?? "");
  const [stock, setStock] = useState(product ? String(product.stock) : "1");
  const [credEmail, setCredEmail] = useState("");
  const [credPwd, setCredPwd] = useState("");
  const [busy, setBusy] = useState(false);

  const minPrice = cats.find(c => c.name === cat)?.min_price ?? 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const b = parseFloat(base);
    if (!name.trim() || !b || b <= 0) return toast.error("Fill required fields");
    if (b < minPrice) return toast.error(`Minimum price for ${cat} is ₹${minPrice}`);
    if (!editing && (!credEmail || !credPwd)) return toast.error("Add a starter credential to enable auto-delivery");
    setBusy(true);

    if (editing) {
      const { error } = await supabase.from("products").update({
        service_name: name.trim(), description: desc.trim() || null, category: cat as any,
        base_price: b, display_price: calcDisplayPrice(b),
        duration: duration.trim() || null,
      }).eq("id", product!.id);
      if (error) { setBusy(false); return toast.error(error.message); }
      toast.success("Product updated");
    } else {
      const { data: newProd, error } = await supabase.from("products").insert({
        seller_id: userId, service_name: name.trim(), description: desc.trim() || null,
        category: cat as any, base_price: b, display_price: calcDisplayPrice(b),
        credentials_email: credEmail.trim(), credentials_password: credPwd,
        duration: duration.trim() || null, stock: parseInt(stock) || 1, is_active: true,
      }).select("id").single();
      if (error || !newProd) { setBusy(false); return toast.error(error?.message ?? "Failed"); }
      // Seed first credential into the pool
      await supabase.from("product_credentials").insert({
        product_id: newProd.id, seller_id: userId,
        cred_email: credEmail.trim(), cred_password: credPwd,
      });
      toast.success("Product is live");
      setName(""); setDesc(""); setBase(""); setCredEmail(""); setCredPwd(""); setDuration(""); setStock("1");
    }
    setBusy(false); setOpen(false); onDone();
  };

  const previewPrice = parseFloat(base) ? calcDisplayPrice(parseFloat(base)) : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button size="icon" variant="ghost" className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>
        ) : (
          <Button><Plus className="h-4 w-4 mr-2" /> Add product</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit product" : "List a new service"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={cat} onValueChange={setCat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(cats.length ? cats.map(c => c.name) : [cat]).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
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
              <Label>Base price (₹) {minPrice > 0 && <span className="text-xs text-muted-foreground font-normal">— min ₹{minPrice}</span>}</Label>
              <Input type="number" step="0.01" min={minPrice || 1} value={base} onChange={(e) => setBase(e.target.value)} required />
              {parseFloat(base) > 0 && parseFloat(base) < minPrice && (
                <p className="text-xs text-destructive">Price must be at least ₹{minPrice} for {cat}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Sells at (auto +10%)</Label>
              <div className="h-10 px-3 rounded-md border border-border bg-muted flex items-center font-semibold text-primary">{previewPrice ? inr(previewPrice) : "—"}</div>
            </div>
          </div>
          {!editing && (
            <>
              <div className="space-y-1.5">
                <Label>Total slots</Label>
                <Input type="number" min="1" value={stock} onChange={(e) => setStock(e.target.value)} />
                <p className="text-xs text-muted-foreground">You can add more credentials later from the Credentials tab.</p>
              </div>
              <div className="border-t border-border pt-4 space-y-3">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">First credential (auto-delivered)</Label>
                </div>
                <div className="space-y-1.5">
                  <Label>Email / username</Label>
                  <Input value={credEmail} onChange={(e) => setCredEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Password / access link</Label>
                  <Input value={credPwd} onChange={(e) => setCredPwd(e.target.value)} required />
                </div>
              </div>
            </>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{editing ? "Save changes" : "Submit for review"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ============= CREDENTIAL DIALOG =============

const CredentialDialog = ({ products, onDone, userId }: { products: Product[]; onDone: () => void; userId: string }) => {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) return toast.error("Select a product");
    const lines = bulk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return toast.error("Add at least one credential");
    const rows = lines.map((line) => {
      const [email, password] = line.split(/[:|,\t]/).map((s) => s?.trim());
      return email && password ? { product_id: productId, seller_id: userId, cred_email: email, cred_password: password } : null;
    }).filter(Boolean) as any[];
    if (!rows.length) return toast.error("Format: email:password (one per line)");
    setBusy(true);
    const { error } = await supabase.from("product_credentials").insert(rows);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} credential${rows.length === 1 ? "" : "s"} added`);
    setBulk(""); setOpen(false); onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={products.length === 0}><Plus className="h-4 w-4 mr-1.5" /> Add credentials</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Bulk upload credentials</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Choose product" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.service_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Credentials (one per line)</Label>
            <Textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={8} placeholder={"user1@gmail.com:Password123\nuser2@gmail.com:Password456"} className="font-mono text-sm" />
            <p className="text-xs text-muted-foreground">Format: <code>email:password</code> (or use <code>,</code> / <code>|</code> as separator)</p>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Upload
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ============= WITHDRAW DIALOG =============

const WithdrawDialog = ({ balance, onDone, userId }: { balance: number; onDone: () => void; userId: string }) => {
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState("");
  const [upi, setUpi] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = parseFloat(amt);
    if (!a || a <= 0) return toast.error("Invalid amount");
    if (a > balance) return toast.error("Amount exceeds balance");
    if (!upi.trim()) return toast.error("UPI ID required");
    setBusy(true);
    const { error } = await supabase.from("withdrawals").insert({ seller_id: userId, amount: a, upi_id: upi.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Withdrawal requested");
    setAmt(""); setUpi(""); setOpen(false); onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" disabled={balance <= 0}><Banknote className="h-4 w-4 mr-2" />Withdraw {inr(balance)}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Request withdrawal</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Amount (₹) — available {inr(balance)}</Label>
            <Input type="number" step="0.01" min="1" max={balance} value={amt} onChange={(e) => setAmt(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Your UPI ID</Label>
            <Input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="yourname@bank" required />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default Seller;
