import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Tv, Brain, Shield, Share2, ArrowRight, CheckCircle2, Lock, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import heroImg from "@/assets/hero.jpg";

const categories = [
  { name: "OTT", icon: Tv, color: "from-rose-500 to-pink-600" },
  { name: "AI Tools", icon: Brain, color: "from-violet-500 to-indigo-600" },
  { name: "VPN", icon: Shield, color: "from-sky-500 to-blue-600" },
  { name: "SMM", icon: Share2, color: "from-amber-500 to-orange-600" },
];

type Product = {
  id: string;
  service_name: string;
  category: string;
  display_price: number;
  duration: string | null;
  image_url: string | null;
};

const Index = () => {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    document.title = "StreamCart — Short-Term Access To Your Favorite Platforms";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Buy short-term access to OTT, AI tools, VPN and SMM services. Trusted multi-vendor marketplace.");
    supabase
      .from("products")
      .select("id, service_name, category, display_price, duration, image_url")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => setProducts((data as Product[]) ?? []));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="container py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              19,000+ orders delivered
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight">
              Short-Term Access To Your <span className="text-primary">Favorite Platforms.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              Instantly buy verified credentials for OTT, AI tools, VPN and SMM panels — at a fraction of the price.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/browse">Browse services <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/sell">Become a seller</Link>
              </Button>
            </div>
            {/* Stat bar */}
            <div className="flex flex-wrap gap-6 pt-4 text-sm">
              <Stat label="Yesterday" value="216" />
              <div className="h-8 w-px bg-border" />
              <Stat label="Today" value="78" />
              <div className="h-8 w-px bg-border" />
              <Stat label="Total" value="19,000+" />
            </div>
          </div>
          <div className="relative">
            <div className="card-elevated overflow-hidden">
              <img src={heroImg} alt="Premium digital services hub" width={1536} height={1024} className="w-full h-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="container py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Shop by category</h2>
            <p className="text-muted-foreground mt-1">Premium services across every digital need.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((c) => (
            <Link
              key={c.name}
              to={`/browse?cat=${encodeURIComponent(c.name)}`}
              className="card-elevated p-6 flex flex-col items-center gap-3 text-center group"
            >
              <div className={`h-16 w-16 rounded-full bg-gradient-to-br ${c.color} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform`}>
                <c.icon className="h-7 w-7" />
              </div>
              <div className="font-semibold">{c.name}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* PRODUCTS PREVIEW */}
      <section className="container py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Trending services</h2>
            <p className="text-muted-foreground mt-1">Fresh listings from approved vendors.</p>
          </div>
          <Button variant="ghost" asChild><Link to="/browse">View all <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
        {products.length === 0 ? (
          <div className="card-elevated p-12 text-center text-muted-foreground">
            No products yet — be the first vendor!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {products.map((p) => (
              <Link key={p.id} to={`/browse`} className="card-elevated p-5 flex flex-col gap-3">
                <div className="aspect-video rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.service_name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="text-3xl font-bold text-muted-foreground">{p.service_name.slice(0, 1)}</div>
                  )}
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{p.service_name}</div>
                    <div className="text-xs text-muted-foreground">{p.category}{p.duration ? ` • ${p.duration}` : ""}</div>
                  </div>
                  <div className="font-bold text-primary">{inr(p.display_price)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* TRUST */}
      <section className="container py-16">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Zap, title: "Instant delivery", desc: "Credentials revealed in your dashboard the moment you pay." },
            { icon: Lock, title: "Wallet protected", desc: "Funds stay in your wallet until you choose what to buy." },
            { icon: CheckCircle2, title: "Vetted vendors", desc: "Every seller and listing is reviewed by our admin team." },
          ].map((f) => (
            <div key={f.title} className="card-elevated p-6">
              <div className="h-10 w-10 rounded-lg bg-accent text-accent-foreground flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5" />
              </div>
              <div className="font-semibold mb-1">{f.title}</div>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="text-xl font-bold">{value}</div>
  </div>
);

export default Index;
