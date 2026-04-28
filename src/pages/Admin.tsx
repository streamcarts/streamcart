import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import { CheckCircle2, XCircle, IndianRupee, Users, Package, ArrowDownToLine, Eye, Search, Ban, ShieldAlert, Star, Flame, Megaphone, Ticket, Tag, BarChart3, RotateCcw, Settings as SettingsIcon, AlertTriangle, Loader2, Plus, MessageSquare, ShieldCheck, TrendingUp } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AffiliatesPanel } from "@/components/AffiliatesPanel";

const Admin = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // Datasets
  const [vapps, setVapps] = useState<any[]>([]);
  const [pendingProducts, setPendingProducts] = useState<any[]>([]);
  const [topups, setTopups] = useState<any[]>([]);
  const [wds, setWds] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allRoles, setAllRoles] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [annos, setAnnos] = useState<any[]>([]);
  const [fraudFlags, setFraudFlags] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => { document.title = "Admin panel — StreamCart"; loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [v, p, t, w, oRes, profs, roles, prods, refs, cps, tks, ans, ffs, st] = await Promise.all([
      supabase.from("vendor_applications").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("wallet_topups").select("*").order("created_at", { ascending: false }),
      supabase.from("withdrawals").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id,role"),
      supabase.from("products").select("id,seller_id,service_name,category,base_price,display_price,status,stock,is_active,is_featured,is_trending,avg_rating,rating_count").order("created_at", { ascending: false }),
      supabase.from("refunds").select("*").order("created_at", { ascending: false }),
      supabase.from("coupons").select("*").order("created_at", { ascending: false }),
      supabase.from("support_tickets").select("*").order("updated_at", { ascending: false }),
      supabase.from("announcements").select("*").order("created_at", { ascending: false }),
      supabase.from("fraud_flags").select("*").eq("resolved", false).order("created_at", { ascending: false }),
      supabase.from("platform_settings").select("*").maybeSingle(),
    ]);

    setVapps(v.data ?? []);
    setPendingProducts((p.data ?? []).filter((x: any) => x.status === "hidden"));
    setTopups((t.data ?? []).filter((x: any) => x.status === "pending"));
    setWds((w.data ?? []).filter((x: any) => x.status === "pending"));
    setAllOrders(oRes.data ?? []);
    setAllUsers(profs.data ?? []);
    setAllRoles(roles.data ?? []);
    setAllProducts(prods.data ?? []);
    setRefunds(refs.data ?? []);
    setCoupons(cps.data ?? []);
    setTickets(tks.data ?? []);
    setAnnos(ans.data ?? []);
    setFraudFlags(ffs.data ?? []);
    setSettings(st.data);
    setLoading(false);
  };

  // ===== Aggregations =====
  const stats = useMemo(() => {
    const totalCommission = allOrders.reduce((s, o) => s + Number(o.admin_commission || 0), 0);
    const totalRevenue = allOrders.reduce((s, o) => s + Number(o.total_paid || 0), 0);
    const sellerCount = new Set(allRoles.filter(r => r.role === "seller").map(r => r.user_id)).size;
    const buyerCount = new Set(allOrders.map(o => o.buyer_id)).size;
    return {
      commission: totalCommission,
      revenue: totalRevenue,
      orders: allOrders.length,
      users: allUsers.length,
      sellers: sellerCount,
      buyers: buyerCount,
    };
  }, [allOrders, allRoles, allUsers]);

  // 30-day series
  const series = useMemo(() => {
    const days: { date: string; label: string; revenue: number; commission: number; orders: number }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      days.push({ date: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), revenue: 0, commission: 0, orders: 0 });
    }
    allOrders.forEach((o) => {
      const k = (o.created_at || "").slice(0, 10);
      const day = days.find(d => d.date === k);
      if (day) {
        day.revenue += Number(o.total_paid || 0);
        day.commission += Number(o.admin_commission || 0);
        day.orders += 1;
      }
    });
    return days;
  }, [allOrders]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { id: string; name: string; sales: number; revenue: number }>();
    allOrders.forEach(o => {
      const cur = map.get(o.product_id) ?? { id: o.product_id, name: o.service_name, sales: 0, revenue: 0 };
      cur.sales += 1;
      cur.revenue += Number(o.total_paid || 0);
      map.set(o.product_id, cur);
    });
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [allOrders]);

  const topSellers = useMemo(() => {
    const map = new Map<string, { id: string; sales: number; revenue: number }>();
    allOrders.forEach(o => {
      const cur = map.get(o.seller_id) ?? { id: o.seller_id, sales: 0, revenue: 0 };
      cur.sales += 1;
      cur.revenue += Number(o.seller_earning || 0);
      map.set(o.seller_id, cur);
    });
    const arr = [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    return arr.map(s => ({ ...s, name: allUsers.find(u => u.id === s.id)?.display_name ?? "Seller", email: allUsers.find(u => u.id === s.id)?.email }));
  }, [allOrders, allUsers]);

  // ===== Operations =====
  const approveVendor = async (id: string) => {
    const { error } = await supabase.rpc("approve_vendor", { _app_id: id });
    if (error) return toast.error(error.message);
    toast.success("Vendor approved"); loadAll();
  };
  const rejectVendor = async (id: string) => {
    const { error } = await supabase.from("vendor_applications").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Rejected"); loadAll();
  };
  const flagVendor = async (id: string, flagged: boolean, reason?: string) => {
    const { error } = await supabase.from("vendor_applications").update({ is_flagged: flagged, flag_reason: flagged ? reason ?? "Flagged by admin" : null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(flagged ? "Vendor flagged" : "Flag cleared"); loadAll();
  };
  const setProductStatus = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("products").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Product ${status}`); loadAll();
  };
  const approveTopup = async (id: string) => {
    const { error } = await supabase.rpc("approve_topup", { _topup_id: id });
    if (error) return toast.error(error.message);
    toast.success("Wallet credited"); loadAll();
  };
  const rejectTopup = async (id: string) => {
    const { error } = await supabase.from("wallet_topups").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Top-up rejected"); loadAll();
  };
  const approveWd = async (id: string) => {
    const { error } = await supabase.rpc("approve_withdrawal", { _wd_id: id });
    if (error) return toast.error(error.message);
    toast.success("Withdrawal approved"); loadAll();
  };
  const rejectWd = async (id: string) => {
    const { error } = await supabase.from("withdrawals").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Withdrawal rejected"); loadAll();
  };
  const viewScreenshot = async (path: string) => {
    const { data } = await supabase.storage.from("topup-screenshots").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const pendingCount = vapps.filter(v => v.status === "pending").length + pendingProducts.length + topups.length + wds.length;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-10 space-y-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Admin panel</h1>
            <p className="text-muted-foreground">Real-time control over users, sellers, and revenue.</p>
          </div>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="text-sm py-1.5 px-3"><AlertTriangle className="h-3.5 w-3.5 mr-1.5 text-warning" />{pendingCount} pending action{pendingCount === 1 ? "" : "s"}</Badge>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat loading={loading} icon={<IndianRupee className="h-5 w-5" />} label="Admin profit" value={inr(stats.commission)} accent />
          <Stat loading={loading} icon={<BarChart3 className="h-5 w-5" />} label="Total revenue" value={inr(stats.revenue)} />
          <Stat loading={loading} icon={<Package className="h-5 w-5" />} label="Total orders" value={String(stats.orders)} />
          <Stat loading={loading} icon={<Users className="h-5 w-5" />} label="Users" value={`${stats.users} (${stats.sellers} sellers)`} />
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto justify-start gap-1">
            <TabsTrigger value="overview"><BarChart3 className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Overview</span></TabsTrigger>
            <TabsTrigger value="queue"><AlertTriangle className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Queue</span> ({pendingCount})</TabsTrigger>
            <TabsTrigger value="users"><Users className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Users</span></TabsTrigger>
            <TabsTrigger value="sellers"><ShieldCheck className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Sellers</span></TabsTrigger>
            <TabsTrigger value="products"><Package className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Products</span></TabsTrigger>
            <TabsTrigger value="finance"><IndianRupee className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Finance</span></TabsTrigger>
            <TabsTrigger value="coupons"><Tag className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Coupons</span></TabsTrigger>
            <TabsTrigger value="tickets"><Ticket className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Tickets</span></TabsTrigger>
            <TabsTrigger value="announce"><Megaphone className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Announce</span></TabsTrigger>
            <TabsTrigger value="affiliates"><TrendingUp className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Affiliates</span></TabsTrigger>
            <TabsTrigger value="settings"><SettingsIcon className="h-4 w-4 md:mr-1.5" /><span className="hidden md:inline">Settings</span></TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-6">
            <Card className="p-6">
              <h2 className="font-semibold mb-4">Revenue & commission (last 30 days)</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} interval={4} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => inr(v)} />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} name="Revenue" />
                    <Line type="monotone" dataKey="commission" stroke="hsl(var(--warning))" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Profit" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="font-semibold mb-4">Daily orders</h2>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} interval={4} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" /> Top selling products</h3>
                {topProducts.length === 0 ? <Empty msg="No sales yet." /> : (
                  <div className="space-y-2">
                    {topProducts.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                        <div className="w-6 text-center font-bold text-muted-foreground">{i + 1}</div>
                        <div className="flex-1 min-w-0"><div className="font-medium truncate">{p.name}</div><div className="text-xs text-muted-foreground">{p.sales} sale{p.sales === 1 ? "" : "s"}</div></div>
                        <div className="font-semibold text-primary">{inr(p.revenue)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              <Card className="p-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2"><Flame className="h-4 w-4 text-primary" /> Top sellers</h3>
                {topSellers.length === 0 ? <Empty msg="No sellers yet." /> : (
                  <div className="space-y-2">
                    {topSellers.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                        <div className="w-6 text-center font-bold text-muted-foreground">{i + 1}</div>
                        <div className="flex-1 min-w-0"><div className="font-medium truncate">{s.name}</div><div className="text-xs text-muted-foreground truncate">{s.email}</div></div>
                        <div className="text-right"><div className="font-semibold">{inr(s.revenue)}</div><div className="text-xs text-muted-foreground">{s.sales} sales</div></div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {fraudFlags.length > 0 && (
              <Card className="p-6 border-warning/40 bg-warning/5">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-warning"><ShieldAlert className="h-4 w-4" /> Fraud signals ({fraudFlags.length})</h3>
                <div className="space-y-2">
                  {fraudFlags.slice(0, 5).map((f) => (
                    <div key={f.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                      <div>
                        <div className="font-mono text-xs">{f.user_id.slice(0, 8)}…</div>
                        <div>{f.signal} <Badge variant="outline" className="ml-1 text-[10px] capitalize">{f.severity}</Badge></div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={async () => {
                        await supabase.from("fraud_flags").update({ resolved: true }).eq("id", f.id);
                        toast.success("Flag cleared"); loadAll();
                      }}>Clear</Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* QUEUE */}
          <TabsContent value="queue" className="space-y-4">
            <Card className="p-6">
              <h3 className="font-semibold mb-3">Vendor applications ({vapps.filter(v => v.status === "pending").length})</h3>
              {vapps.filter(v => v.status === "pending").length === 0 ? <Empty msg="No pending applications." /> : (
                <div className="space-y-2">
                  {vapps.filter(v => v.status === "pending").map(v => (
                    <div key={v.id} className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg">
                      <div className="min-w-0">
                        <div className="font-medium">{v.business_name} {v.product_type && <Badge variant="outline" className="ml-1 text-xs">{v.product_type}</Badge>}</div>
                        <div className="text-xs text-muted-foreground truncate">{v.description || "—"} {v.experience && `• ${v.experience}`}</div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" onClick={() => approveVendor(v.id)}><CheckCircle2 className="h-4 w-4 mr-1" />Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => rejectVendor(v.id)}><XCircle className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-3">Pending products ({pendingProducts.length})</h3>
              {pendingProducts.length === 0 ? <Empty msg="No products awaiting review." /> : (
                <div className="space-y-2">
                  {pendingProducts.map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg">
                      <div className="min-w-0">
                        <div className="font-medium">{p.service_name} <Badge variant="outline" className="ml-1 text-xs">{p.category}</Badge></div>
                        <div className="text-xs text-muted-foreground">Base {inr(p.base_price)} → {inr(p.display_price)} • Stock {p.stock}</div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" onClick={() => setProductStatus(p.id, "approved")}><CheckCircle2 className="h-4 w-4 mr-1" />Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => setProductStatus(p.id, "rejected")}><XCircle className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-3">Top-ups ({topups.length})</h3>
              {topups.length === 0 ? <Empty msg="No pending top-ups." /> : (
                <div className="space-y-2">
                  {topups.map(t => (
                    <div key={t.id} className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg">
                      <div><div className="font-semibold">{inr(t.amount)}</div><div className="text-xs text-muted-foreground">Ref: {t.upi_reference || "—"}</div></div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => viewScreenshot(t.screenshot_path)}><Eye className="h-4 w-4" /></Button>
                        <Button size="sm" onClick={() => approveTopup(t.id)}><CheckCircle2 className="h-4 w-4 mr-1" />Credit</Button>
                        <Button size="sm" variant="outline" onClick={() => rejectTopup(t.id)}><XCircle className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-3">Withdrawals ({wds.length})</h3>
              {wds.length === 0 ? <Empty msg="No pending withdrawals." /> : (
                <div className="space-y-2">
                  {wds.map(w => (
                    <div key={w.id} className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg">
                      <div><div className="font-semibold">{inr(w.amount)}</div><div className="text-xs text-muted-foreground">UPI: <code>{w.upi_id}</code></div></div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" onClick={() => approveWd(w.id)}><ArrowDownToLine className="h-4 w-4 mr-1" />Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => rejectWd(w.id)}><XCircle className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* USERS */}
          <TabsContent value="users"><UsersPanel users={allUsers} roles={allRoles} orders={allOrders} onChange={loadAll} /></TabsContent>

          {/* SELLERS */}
          <TabsContent value="sellers"><SellersPanel vapps={vapps} users={allUsers} orders={allOrders} products={allProducts} onChange={loadAll} onFlag={flagVendor} /></TabsContent>

          {/* PRODUCTS */}
          <TabsContent value="products"><ProductsPanel products={allProducts} onChange={loadAll} /></TabsContent>

          {/* FINANCE */}
          <TabsContent value="finance"><FinancePanel orders={allOrders} refunds={refunds} users={allUsers} onChange={loadAll} /></TabsContent>

          {/* COUPONS */}
          <TabsContent value="coupons"><CouponsPanel coupons={coupons} onChange={loadAll} /></TabsContent>

          {/* TICKETS */}
          <TabsContent value="tickets"><TicketsPanel tickets={tickets} users={allUsers} adminId={user!.id} onChange={loadAll} /></TabsContent>

          {/* ANNOUNCEMENTS */}
          <TabsContent value="announce"><AnnouncementsPanel annos={annos} onChange={loadAll} /></TabsContent>

          {/* AFFILIATES */}
          <TabsContent value="affiliates"><AffiliatesPanel /></TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings"><SettingsPanel settings={settings} onChange={loadAll} /></TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

// ============= SHARED =============

const Stat = ({ icon, label, value, accent, loading }: any) => (
  <Card className="p-5 flex items-center gap-3">
    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${accent ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>{icon}</div>
    <div className="min-w-0">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{label}</div>
      {loading ? <Skeleton className="h-7 w-24 mt-1" /> : <div className="text-xl font-bold truncate">{value}</div>}
    </div>
  </Card>
);

const Empty = ({ msg }: { msg: string }) => <p className="text-center text-muted-foreground py-6 text-sm">{msg}</p>;

// ============= USERS PANEL =============

const UsersPanel = ({ users, roles, orders, onChange }: any) => {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  const enriched = useMemo(() => {
    return users.map((u: any) => {
      const userRoles = roles.filter((r: any) => r.user_id === u.id).map((r: any) => r.role);
      const userOrders = orders.filter((o: any) => o.buyer_id === u.id);
      const userSales = orders.filter((o: any) => o.seller_id === u.id);
      return { ...u, roles: userRoles, orderCount: userOrders.length, salesCount: userSales.length };
    });
  }, [users, roles, orders]);

  const filtered = enriched.filter((u: any) => {
    if (q && !`${u.email} ${u.display_name ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "banned") return u.is_banned;
    if (filter === "sellers") return u.roles.includes("seller");
    if (filter === "buyers") return !u.roles.includes("seller") && !u.roles.includes("admin");
    return true;
  });

  const toggleBan = async (u: any, banned: boolean, reason?: string) => {
    const { error } = await supabase.rpc("set_user_ban", { _user_id: u.id, _banned: banned, _reason: reason ?? null });
    if (error) return toast.error(error.message);
    toast.success(banned ? "User banned" : "User unbanned");
    onChange();
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by email or name…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            <SelectItem value="buyers">Buyers</SelectItem>
            <SelectItem value="sellers">Sellers</SelectItem>
            <SelectItem value="banned">Banned</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {filtered.length === 0 ? <Empty msg="No users match." /> : (
        <div className="space-y-2">
          {filtered.slice(0, 100).map((u: any) => (
            <div key={u.id} className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{u.display_name || u.email}</span>
                  {u.roles.map((r: string) => <Badge key={r} variant="outline" className="text-[10px] capitalize">{r}</Badge>)}
                  {u.is_banned && <Badge variant="destructive" className="text-[10px]">Banned</Badge>}
                </div>
                <div className="text-xs text-muted-foreground truncate">{u.email} • {u.orderCount} orders • {u.salesCount} sales</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {u.is_banned ? (
                  <Button size="sm" variant="outline" onClick={() => toggleBan(u, false)}>Unban</Button>
                ) : (
                  <BanDialog onConfirm={(reason) => toggleBan(u, true, reason)} />
                )}
              </div>
            </div>
          ))}
          {filtered.length > 100 && <p className="text-xs text-muted-foreground text-center pt-2">Showing first 100 of {filtered.length}</p>}
        </div>
      )}
    </Card>
  );
};

const BanDialog = ({ onConfirm }: { onConfirm: (reason: string) => void }) => {
  const [reason, setReason] = useState("");
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button size="sm" variant="ghost"><Ban className="h-3.5 w-3.5 mr-1" />Ban</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Ban this user?</AlertDialogTitle><AlertDialogDescription>They will be unable to purchase or sell. You can unban anytime.</AlertDialogDescription></AlertDialogHeader>
        <Input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onConfirm(reason)}>Ban user</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// ============= SELLERS PANEL =============

const SellersPanel = ({ vapps, users, orders, products, onChange, onFlag }: any) => {
  const sellers = useMemo(() => {
    const approved = vapps.filter((v: any) => v.status === "approved");
    return approved.map((v: any) => {
      const profile = users.find((u: any) => u.id === v.user_id);
      const sales = orders.filter((o: any) => o.seller_id === v.user_id);
      const revenue = sales.reduce((s: number, o: any) => s + Number(o.seller_earning), 0);
      const productsCount = products.filter((p: any) => p.seller_id === v.user_id).length;
      const ratings = products.filter((p: any) => p.seller_id === v.user_id && p.rating_count > 0);
      const avgRating = ratings.length ? ratings.reduce((s: number, p: any) => s + Number(p.avg_rating), 0) / ratings.length : 0;
      return { ...v, profile, salesCount: sales.length, revenue, productsCount, avgRating };
    }).sort((a: any, b: any) => b.revenue - a.revenue);
  }, [vapps, users, orders, products]);

  return (
    <Card className="p-6 space-y-3">
      <h3 className="font-semibold">Approved sellers ({sellers.length})</h3>
      {sellers.length === 0 ? <Empty msg="No approved sellers yet." /> : (
        <div className="space-y-2">
          {sellers.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold truncate">{s.business_name}</span>
                  {s.is_flagged && <Badge variant="destructive" className="text-[10px]"><ShieldAlert className="h-3 w-3 mr-1" />Flagged</Badge>}
                  {s.profile?.is_banned && <Badge variant="destructive" className="text-[10px]">Banned</Badge>}
                  {s.avgRating > 0 && <span className="text-xs flex items-center gap-1 text-muted-foreground"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{s.avgRating.toFixed(1)}</span>}
                </div>
                <div className="text-xs text-muted-foreground truncate">{s.profile?.email} • {s.productsCount} products • {s.salesCount} sales • {inr(s.revenue)} earned</div>
                {s.is_flagged && s.flag_reason && <div className="text-xs text-destructive mt-1">⚠ {s.flag_reason}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.is_flagged ? (
                  <Button size="sm" variant="outline" onClick={() => onFlag(s.id, false)}>Clear flag</Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => onFlag(s.id, true, prompt("Reason for flag?") ?? undefined)}><ShieldAlert className="h-3.5 w-3.5 mr-1" />Flag</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

// ============= PRODUCTS PANEL =============

const ProductsPanel = ({ products, onChange }: any) => {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const filtered = products.filter((p: any) => {
    if (q && !p.service_name.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "featured") return p.is_featured;
    if (filter === "trending") return p.is_trending;
    if (filter === "hidden") return p.status !== "approved";
    return true;
  });

  const toggle = async (p: any, field: "is_featured" | "is_trending" | "is_active", v: boolean) => {
    const update: any = { [field]: v };
    const { error } = await supabase.from("products").update(update).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    onChange();
  };

  const remove = async (p: any) => {
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Product removed");
    onChange();
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            <SelectItem value="featured">Featured</SelectItem>
            <SelectItem value="trending">Trending</SelectItem>
            <SelectItem value="hidden">Pending/Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        {filtered.slice(0, 100).map((p: any) => (
          <div key={p.id} className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{p.service_name}</span>
                <Badge variant="outline" className="text-[10px]">{p.category}</Badge>
                <Badge variant={p.status === "approved" ? "default" : "secondary"} className="text-[10px] capitalize">{p.status}</Badge>
                {p.is_featured && <Badge className="text-[10px] bg-amber-500 hover:bg-amber-600"><Star className="h-2.5 w-2.5 mr-0.5" />Featured</Badge>}
                {p.is_trending && <Badge className="text-[10px] bg-orange-500 hover:bg-orange-600"><Flame className="h-2.5 w-2.5 mr-0.5" />Trending</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">Base {inr(p.base_price)} → {inr(p.display_price)} • Stock {p.stock}</div>
            </div>
            <div className="flex items-center gap-3 text-xs shrink-0">
              <label className="flex items-center gap-1.5"><Switch checked={p.is_featured} onCheckedChange={(v) => toggle(p, "is_featured", v)} />Feature</label>
              <label className="flex items-center gap-1.5"><Switch checked={p.is_trending} onCheckedChange={(v) => toggle(p, "is_trending", v)} />Trend</label>
              <label className="flex items-center gap-1.5"><Switch checked={p.is_active} onCheckedChange={(v) => toggle(p, "is_active", v)} />Active</label>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><XCircle className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Remove "{p.service_name}"?</AlertDialogTitle></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => remove(p)}>Remove</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <Empty msg="No products match." />}
      </div>
    </Card>
  );
};

// ============= FINANCE PANEL =============

const FinancePanel = ({ orders, refunds, users, onChange }: any) => {
  const [q, setQ] = useState("");
  const filtered = orders.filter((o: any) => {
    if (!q) return true;
    return o.id.includes(q) || o.service_name.toLowerCase().includes(q.toLowerCase()) || (o.credentials_email || "").toLowerCase().includes(q.toLowerCase());
  });

  const refundOrder = async (orderId: string, reason: string) => {
    const { error } = await supabase.rpc("issue_refund", { _order_id: orderId, _reason: reason || null });
    if (error) return toast.error(error.message);
    toast.success("Refund processed — wallets adjusted");
    onChange();
  };

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-semibold">All transactions ({orders.length})</h3>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by order ID, service, email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          {filtered.slice(0, 100).map((o: any) => {
            const buyer = users.find((u: any) => u.id === o.buyer_id);
            const isRefunded = o.status === "refunded";
            return (
              <div key={o.id} className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0">
                <div className="min-w-0">
                  <div className="font-medium truncate">{o.service_name} <span className="text-xs text-muted-foreground">#{o.id.slice(0, 8).toUpperCase()}</span></div>
                  <div className="text-xs text-muted-foreground truncate">{buyer?.email ?? "Unknown buyer"} • {new Date(o.created_at).toLocaleString()}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold">{inr(o.total_paid)}</div>
                  <div className="text-xs text-muted-foreground">Profit {inr(o.admin_commission)}</div>
                </div>
                {isRefunded ? (
                  <Badge variant="destructive" className="text-[10px]">Refunded</Badge>
                ) : (
                  <RefundDialog onConfirm={(r) => refundOrder(o.id, r)} />
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <Empty msg="No orders match." />}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-3">Refunds issued ({refunds.length})</h3>
        {refunds.length === 0 ? <Empty msg="No refunds yet." /> : (
          <div className="space-y-2">
            {refunds.slice(0, 50).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0 text-sm">
                <div className="min-w-0">
                  <div>#{r.order_id.slice(0, 8).toUpperCase()} • {inr(r.amount)}</div>
                  <div className="text-xs text-muted-foreground">{r.reason || "—"} • {new Date(r.created_at).toLocaleString()}</div>
                </div>
                <Badge variant="secondary" className="capitalize">{r.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

const RefundDialog = ({ onConfirm }: any) => {
  const [reason, setReason] = useState("");
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button size="sm" variant="outline"><RotateCcw className="h-3.5 w-3.5 mr-1" />Refund</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Refund this order?</AlertDialogTitle><AlertDialogDescription>The buyer's wallet will be credited the full amount and the seller's wallet will be debited. The credential returns to the available pool.</AlertDialogDescription></AlertDialogHeader>
        <Input placeholder="Reason (shown to seller)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onConfirm(reason)}>Process refund</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// ============= COUPONS PANEL =============

const CouponsPanel = ({ coupons, onChange }: any) => {
  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between"><h3 className="font-semibold">Coupons ({coupons.length})</h3><CouponDialog onDone={onChange} /></div>
      {coupons.length === 0 ? <Empty msg="No coupons yet. Create your first promo code." /> : (
        <div className="space-y-2">
          {coupons.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-mono font-bold text-primary">{c.code}</code>
                  <Badge variant="outline" className="text-[10px]">{c.discount_type === "percent" ? `${c.discount_value}% OFF` : `${inr(c.discount_value)} OFF`}</Badge>
                  {!c.is_active && <Badge variant="secondary">Inactive</Badge>}
                  {c.expires_at && new Date(c.expires_at) < new Date() && <Badge variant="destructive">Expired</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">Used {c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""} • Min order {inr(c.min_order_value)}{c.expires_at ? ` • expires ${new Date(c.expires_at).toLocaleDateString()}` : ""}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={c.is_active} onCheckedChange={async (v) => {
                  await supabase.from("coupons").update({ is_active: v }).eq("id", c.id);
                  onChange();
                }} />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => {
                  if (!confirm("Delete coupon?")) return;
                  await supabase.from("coupons").delete().eq("id", c.id);
                  toast.success("Deleted"); onChange();
                }}><XCircle className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

const CouponDialog = ({ onDone }: any) => {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [val, setVal] = useState("");
  const [minOrder, setMinOrder] = useState("0");
  const [maxUses, setMaxUses] = useState("");
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!code.trim() || !val) return toast.error("Code and value required");
    setBusy(true);
    const { error } = await supabase.from("coupons").insert({
      code: code.trim().toUpperCase(),
      discount_type: type,
      discount_value: parseFloat(val),
      min_order_value: parseFloat(minOrder) || 0,
      max_uses: maxUses ? parseInt(maxUses) : null,
      expires_at: expires || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Coupon created");
    setCode(""); setVal(""); setMaxUses(""); setExpires(""); setMinOrder("0"); setOpen(false); onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1.5" />New coupon</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create coupon</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WELCOME20" maxLength={32} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="percent">Percent (%)</SelectItem><SelectItem value="fixed">Fixed (₹)</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Value</Label><Input type="number" min="1" value={val} onChange={(e) => setVal(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Min order (₹)</Label><Input type="number" min="0" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Max uses (blank = ∞)</Label><Input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Expires at (optional)</Label><Input type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} /></div>
          <DialogFooter><Button onClick={submit} disabled={busy} className="w-full">{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create</Button></DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============= TICKETS PANEL =============

const TicketsPanel = ({ tickets, users, adminId, onChange }: any) => {
  const [active, setActive] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState("");

  const open = async (t: any) => {
    setActive(t);
    const { data } = await supabase.from("ticket_messages").select("*").eq("ticket_id", t.id).order("created_at");
    setMessages(data ?? []);
  };

  const send = async () => {
    if (!reply.trim()) return;
    const { error } = await supabase.from("ticket_messages").insert({ ticket_id: active.id, author_id: adminId, is_admin_reply: true, body: reply.trim() });
    if (error) return toast.error(error.message);
    await supabase.from("support_tickets").update({ status: "pending_user", updated_at: new Date().toISOString() }).eq("id", active.id);
    setReply(""); open(active); onChange();
  };

  const close = async () => {
    await supabase.from("support_tickets").update({ status: "closed", updated_at: new Date().toISOString() }).eq("id", active.id);
    toast.success("Ticket closed"); setActive(null); onChange();
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="p-6 space-y-2">
        <h3 className="font-semibold mb-2">Tickets ({tickets.length})</h3>
        {tickets.length === 0 ? <Empty msg="No tickets." /> : tickets.map((t: any) => {
          const user = users.find((u: any) => u.id === t.user_id);
          return (
            <button key={t.id} onClick={() => open(t)} className={`w-full text-left p-3 rounded-lg border transition-colors ${active?.id === t.id ? "border-primary bg-accent" : "border-border hover:bg-muted/40"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium truncate">{t.subject}</div>
                <Badge variant={t.status === "open" ? "default" : t.status === "closed" ? "secondary" : "outline"} className="text-[10px] capitalize">{t.status.replace("_", " ")}</Badge>
              </div>
              <div className="text-xs text-muted-foreground truncate">{user?.email} • {new Date(t.updated_at).toLocaleString()}</div>
            </button>
          );
        })}
      </Card>
      <Card className="p-6">
        {!active ? <Empty msg="Select a ticket to view." /> : (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div><div className="font-semibold">{active.subject}</div><div className="text-xs text-muted-foreground capitalize">{active.status.replace("_", " ")}</div></div>
              {active.status !== "closed" && <Button size="sm" variant="outline" onClick={close}>Close ticket</Button>}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto max-h-80 pr-1">
              {messages.map((m) => (
                <div key={m.id} className={`p-3 rounded-lg text-sm ${m.is_admin_reply ? "bg-primary/10 ml-8" : "bg-muted mr-8"}`}>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{m.is_admin_reply ? "Admin" : "User"} • {new Date(m.created_at).toLocaleString()}</div>
                  <div className="whitespace-pre-line">{m.body}</div>
                </div>
              ))}
            </div>
            {active.status !== "closed" && (
              <div className="mt-3 space-y-2">
                <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Type your reply…" />
                <Button onClick={send} disabled={!reply.trim()} className="w-full"><MessageSquare className="h-4 w-4 mr-2" />Send reply</Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

// ============= ANNOUNCEMENTS PANEL =============

const AnnouncementsPanel = ({ annos, onChange }: any) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [variant, setVariant] = useState("info");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !body.trim()) return toast.error("Title and body required");
    setBusy(true);
    const { error } = await supabase.from("announcements").insert({ title: title.trim(), body: body.trim(), audience, variant });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Announcement published");
    setTitle(""); setBody(""); setOpen(false); onChange();
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Announcements ({annos.length})</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1.5" />New</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New announcement</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></div>
              <div className="space-y-1.5"><Label>Message</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={500} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Audience</Label>
                  <Select value={audience} onValueChange={setAudience}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Everyone</SelectItem><SelectItem value="buyers">Buyers</SelectItem><SelectItem value="sellers">Sellers</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Style</Label>
                  <Select value={variant} onValueChange={setVariant}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="info">Info</SelectItem><SelectItem value="success">Success</SelectItem><SelectItem value="warning">Warning</SelectItem><SelectItem value="promo">Promo</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={submit} disabled={busy} className="w-full">{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Publish</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {annos.length === 0 ? <Empty msg="No announcements yet." /> : (
        <div className="space-y-2">
          {annos.map((a: any) => (
            <div key={a.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{a.title}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">{a.variant}</Badge>
                  <Badge variant="secondary" className="text-[10px] capitalize">{a.audience}</Badge>
                  {!a.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{a.body}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={a.is_active} onCheckedChange={async (v) => {
                  await supabase.from("announcements").update({ is_active: v }).eq("id", a.id);
                  onChange();
                }} />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => {
                  await supabase.from("announcements").delete().eq("id", a.id);
                  onChange();
                }}><XCircle className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

// ============= SETTINGS PANEL =============

const SettingsPanel = ({ settings, onChange }: any) => {
  const [commission, setCommission] = useState(String(settings?.commission_percent ?? 10));
  const [maintenance, setMaintenance] = useState(!!settings?.maintenance_mode);
  const [upi, setUpi] = useState(settings?.upi_id ?? "streamcart@upi");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (settings) {
      setCommission(String(settings.commission_percent));
      setMaintenance(!!settings.maintenance_mode);
      setUpi(settings.upi_id);
    }
  }, [settings]);

  const save = async () => {
    const c = parseFloat(commission);
    if (isNaN(c) || c < 0 || c > 90) return toast.error("Commission must be 0–90%");
    setBusy(true);
    const { error } = await supabase.from("platform_settings").update({
      commission_percent: c,
      maintenance_mode: maintenance,
      upi_id: upi.trim(),
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved — applies to new orders immediately");
    onChange();
  };

  return (
    <Card className="p-6 max-w-xl space-y-5">
      <h3 className="font-semibold">Platform settings</h3>
      <div className="space-y-1.5">
        <Label>Commission percent (%)</Label>
        <Input type="number" step="0.1" min="0" max="90" value={commission} onChange={(e) => setCommission(e.target.value)} />
        <p className="text-xs text-muted-foreground">Applied to every order. Example: at 10%, ₹100 product → seller gets ₹90, you keep ₹10.</p>
      </div>
      <div className="space-y-1.5">
        <Label>Platform UPI ID (shown on top-up screen)</Label>
        <Input value={upi} onChange={(e) => setUpi(e.target.value)} />
      </div>
      <div className="flex items-center justify-between p-3 border border-border rounded-lg">
        <div>
          <div className="font-medium">Maintenance mode</div>
          <div className="text-xs text-muted-foreground">Hide storefront from non-admin users.</div>
        </div>
        <Switch checked={maintenance} onCheckedChange={setMaintenance} />
      </div>
      <Button onClick={save} disabled={busy} className="w-full">{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save settings</Button>
    </Card>
  );
};

export default Admin;
