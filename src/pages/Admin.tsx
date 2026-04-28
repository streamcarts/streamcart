import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import { CheckCircle2, XCircle, IndianRupee, Users, Package, ArrowDownToLine, Eye } from "lucide-react";

const Admin = () => {
  const [vapps, setVapps] = useState<any[]>([]);
  const [pendingProducts, setPendingProducts] = useState<any[]>([]);
  const [topups, setTopups] = useState<any[]>([]);
  const [wds, setWds] = useState<any[]>([]);
  const [stats, setStats] = useState({ commission: 0, orders: 0, sellers: 0 });

  useEffect(() => { document.title = "Admin panel — StreamCart"; loadAll(); }, []);

  const loadAll = async () => {
    const [v, p, t, w, oRes, sRes] = await Promise.all([
      supabase.from("vendor_applications").select("*").eq("status", "pending").order("created_at"),
      supabase.from("products").select("*").eq("status", "hidden").order("created_at"),
      supabase.from("wallet_topups").select("*").eq("status", "pending").order("created_at"),
      supabase.from("withdrawals").select("*").eq("status", "pending").order("created_at"),
      supabase.from("orders").select("admin_commission"),
      supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "seller"),
    ]);
    setVapps(v.data ?? []); setPendingProducts(p.data ?? []);
    setTopups(t.data ?? []); setWds(w.data ?? []);
    const totalComm = (oRes.data ?? []).reduce((s: number, o: any) => s + Number(o.admin_commission), 0);
    setStats({ commission: totalComm, orders: oRes.data?.length ?? 0, sellers: sRes.count ?? 0 });
  };

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
  const setProductStatus = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("products").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Product ${status}`); loadAll();
  };
  const approveTopup = async (id: string) => {
    const { error } = await supabase.rpc("approve_topup", { _topup_id: id });
    if (error) return toast.error(error.message);
    toast.success("Top-up approved & wallet credited"); loadAll();
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Admin panel</h1>
          <p className="text-muted-foreground">Marketplace operations & analytics.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat icon={<IndianRupee className="h-5 w-5" />} label="Total commission (10%)" value={inr(stats.commission)} />
          <Stat icon={<Package className="h-5 w-5" />} label="Total orders" value={String(stats.orders)} />
          <Stat icon={<Users className="h-5 w-5" />} label="Active sellers" value={String(stats.sellers)} />
        </div>

        <Tabs defaultValue="vendors">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full">
            <TabsTrigger value="vendors">Vendors ({vapps.length})</TabsTrigger>
            <TabsTrigger value="products">Products ({pendingProducts.length})</TabsTrigger>
            <TabsTrigger value="topups">Top-ups ({topups.length})</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals ({wds.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="vendors">
            <Card className="p-6">
              {vapps.length === 0 ? <Empty msg="No pending vendor applications." /> : (
                <div className="space-y-3">
                  {vapps.map((v) => (
                    <div key={v.id} className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg">
                      <div>
                        <div className="font-medium">{v.business_name}</div>
                        <div className="text-xs text-muted-foreground">{v.description}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => approveVendor(v.id)}><CheckCircle2 className="h-4 w-4 mr-1" />Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => rejectVendor(v.id)}><XCircle className="h-4 w-4 mr-1" />Reject</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <Card className="p-6">
              {pendingProducts.length === 0 ? <Empty msg="No products awaiting review." /> : (
                <div className="space-y-3">
                  {pendingProducts.map((p) => (
                    <div key={p.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 border border-border rounded-lg">
                      <div>
                        <div className="font-medium">{p.service_name} <Badge variant="secondary" className="ml-2">{p.category}</Badge></div>
                        <div className="text-xs text-muted-foreground">Base {inr(p.base_price)} → Sells {inr(p.display_price)} • Stock {p.stock}</div>
                        {p.description && <div className="text-xs mt-1">{p.description}</div>}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => setProductStatus(p.id, "approved")}><CheckCircle2 className="h-4 w-4 mr-1" />Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => setProductStatus(p.id, "rejected")}><XCircle className="h-4 w-4 mr-1" />Reject</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="topups">
            <Card className="p-6">
              {topups.length === 0 ? <Empty msg="No pending top-ups." /> : (
                <div className="space-y-3">
                  {topups.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg">
                      <div>
                        <div className="font-semibold">{inr(t.amount)}</div>
                        <div className="text-xs text-muted-foreground">Ref: {t.upi_reference || "—"} • {new Date(t.created_at).toLocaleString()}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => viewScreenshot(t.screenshot_path)}><Eye className="h-4 w-4 mr-1" />Screenshot</Button>
                        <Button size="sm" onClick={() => approveTopup(t.id)}><CheckCircle2 className="h-4 w-4 mr-1" />Credit</Button>
                        <Button size="sm" variant="outline" onClick={() => rejectTopup(t.id)}><XCircle className="h-4 w-4 mr-1" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="withdrawals">
            <Card className="p-6">
              {wds.length === 0 ? <Empty msg="No pending withdrawals." /> : (
                <div className="space-y-3">
                  {wds.map((w) => (
                    <div key={w.id} className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg">
                      <div>
                        <div className="font-semibold">{inr(w.amount)}</div>
                        <div className="text-xs text-muted-foreground">UPI: <code>{w.upi_id}</code> • {new Date(w.created_at).toLocaleString()}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => approveWd(w.id)}><ArrowDownToLine className="h-4 w-4 mr-1" />Approve & debit</Button>
                        <Button size="sm" variant="outline" onClick={() => rejectWd(w.id)}><XCircle className="h-4 w-4 mr-1" /></Button>
                      </div>
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

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <Card className="p-5 flex items-center gap-4">
    <div className="h-11 w-11 rounded-xl bg-accent text-accent-foreground flex items-center justify-center">{icon}</div>
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  </Card>
);
const Empty = ({ msg }: { msg: string }) => <p className="text-center text-muted-foreground py-8 text-sm">{msg}</p>;

export default Admin;
