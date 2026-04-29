import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useCategories } from "@/lib/categories";

const Sell = () => {
  const { user, isSeller, refreshRoles } = useAuth();
  const { cats } = useCategories({ activeOnly: true });
  const navigate = useNavigate();
  const [biz, setBiz] = useState("");
  const [productType, setProductType] = useState("OTT");
  const [experience, setExperience] = useState("");
  const [desc, setDesc] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "Become a seller — StreamCart"; }, []);
  useEffect(() => {
    if (!user) return navigate("/auth?next=/sell");
    if (isSeller) return;
    supabase.from("vendor_applications").select("status").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setStatus(data?.status ?? null));
  }, [user, isSeller, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!biz.trim()) return toast.error("Business name required");
    const wa = whatsapp.replace(/[^0-9+]/g, "");
    if (wa.replace(/[^0-9]/g, "").length < 10) return toast.error("Valid WhatsApp number required (min 10 digits)");
    setBusy(true);
    const { error } = await supabase.from("vendor_applications").insert({
      user_id: user!.id, business_name: biz.trim(), description: desc.trim() || null,
      product_type: productType, experience: experience.trim() || null,
      whatsapp_number: wa,
    });
    if (!error) {
      await supabase.from("profiles").update({ whatsapp_number: wa }).eq("id", user!.id);
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Application submitted! Admin will review shortly.");
    setStatus("pending");
    refreshRoles();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-12 max-w-2xl">
        <h1 className="text-3xl font-bold mb-2">Become a seller</h1>
        <p className="text-muted-foreground mb-8">Earn 90% on every sale. StreamCart adds a 10% markup automatically.</p>
        {isSeller ? (
          <Card className="p-8 text-center">
            <p className="font-semibold mb-3">You're an approved seller 🎉</p>
            <Button onClick={() => navigate("/seller")}>Go to seller dashboard</Button>
          </Card>
        ) : status === "pending" ? (
          <Card className="p-8 text-center">
            <p className="font-semibold">Application pending</p>
            <p className="text-muted-foreground text-sm mt-2">Our team will review and approve your application shortly.</p>
          </Card>
        ) : status === "rejected" ? (
          <Card className="p-8 text-center">
            <p className="font-semibold text-destructive">Application rejected</p>
            <p className="text-muted-foreground text-sm mt-2">Please contact support.</p>
          </Card>
        ) : (
          <Card className="p-6">
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="biz">Business / vendor name</Label>
                <Input id="biz" value={biz} onChange={(e) => setBiz(e.target.value)} maxLength={100} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Product type</Label>
                  <Select value={productType} onValueChange={setProductType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(cats.length ? cats.map(c => c.name) : ["OTT", "AI Tools", "VPN", "Other"]).map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="exp">Experience (optional)</Label>
                  <Input id="exp" value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="e.g. 2 years reselling" maxLength={100} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wa">WhatsApp number <span className="text-destructive">*</span></Label>
                <Input id="wa" type="tel" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+91 98XXXXXXXX" maxLength={20} required />
                <p className="text-[11px] text-muted-foreground">Required so admin can verify and contact you. Never shown to buyers.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="desc">What will you sell?</Label>
                <Textarea id="desc" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} rows={4} />
              </div>
              <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit application</Button>
            </form>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Sell;
