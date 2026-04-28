import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { inr } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, ShoppingCart, Search } from "lucide-react";

type Product = {
  id: string;
  service_name: string;
  category: string;
  description: string | null;
  display_price: number;
  duration: string | null;
  image_url: string | null;
  stock: number;
};

const CATS = ["All", "OTT", "AI Tools", "VPN", "SMM", "Other"];

const Browse = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const cat = params.get("cat") || "All";

  useEffect(() => {
    document.title = "Browse services — StreamCart";
    load();
  }, [cat]);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("products")
      .select("id,service_name,category,description,display_price,duration,image_url,stock")
      .eq("status", "approved")
      .gt("stock", 0)
      .order("created_at", { ascending: false });
    if (cat !== "All") query = query.eq("category", cat as any);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    setProducts((data as Product[]) ?? []);
    setLoading(false);
  };

  const handleBuy = async (id: string) => {
    if (!user) return navigate(`/auth?next=/browse`);
    setBuying(id);
    const { data, error } = await supabase.rpc("purchase_product", { _product_id: id });
    setBuying(null);
    if (error) return toast.error(error.message);
    toast.success("Purchase complete! View credentials in your dashboard.");
    navigate(`/buyer?order=${data}`);
  };

  const filtered = products.filter((p) =>
    !q.trim() ? true : p.service_name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Browse services</h1>
            <p className="text-muted-foreground">Approved listings — instant credential delivery.</p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search services" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {CATS.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={cat === c ? "default" : "outline"}
              onClick={() => setParams(c === "All" ? {} : { cat: c })}
            >
              {c}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="card-elevated p-12 text-center text-muted-foreground">No services found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filtered.map((p) => (
              <article key={p.id} className="card-elevated p-5 flex flex-col gap-4">
                <div className="aspect-video rounded-lg bg-muted overflow-hidden flex items-center justify-center">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.service_name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <span className="text-4xl font-bold text-muted-foreground">{p.service_name.slice(0, 1)}</span>
                  )}
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{p.service_name}</h3>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{p.category}</Badge>
                      {p.duration && <Badge variant="outline" className="text-xs">{p.duration}</Badge>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary">{inr(p.display_price)}</div>
                    <div className="text-xs text-muted-foreground">{p.stock} in stock</div>
                  </div>
                </div>
                {p.description && <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
                <Button onClick={() => handleBuy(p.id)} disabled={buying === p.id} className="mt-auto">
                  {buying === p.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
                  Buy now
                </Button>
              </article>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Browse;
