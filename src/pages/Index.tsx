import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tv, Brain, Shield, Share2, ArrowRight, CheckCircle2, Lock, Zap, Star, Users, IndianRupee, BadgeCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import { ProductGridSkeleton } from "@/components/ProductCardSkeleton";
import heroImg from "@/assets/hero.jpg";

const categories = [
  { name: "OTT", icon: Tv, color: "from-rose-500 to-pink-600", desc: "Netflix, Prime, Hotstar" },
  { name: "AI Tools", icon: Brain, color: "from-violet-500 to-indigo-600", desc: "ChatGPT, Claude, Midjourney" },
  { name: "VPN", icon: Shield, color: "from-sky-500 to-blue-600", desc: "Nord, Express, Surfshark" },
  { name: "SMM", icon: Share2, color: "from-amber-500 to-orange-600", desc: "Followers, panels, analytics" },
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
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    document.title = "StreamCart — Premium Subscriptions at a Fraction of the Price";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Buy verified short-term access to Netflix, ChatGPT, VPN and more. Instant delivery, secure wallet, vetted vendors.");
    supabase
      .from("products")
      .select("id, service_name, category, display_price, duration, image_url")
      .eq("status", "approved")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => setProducts((data as Product[]) ?? []));
  }, []);

  const ratingFor = (id: string) => {
    const seed = Array.from(id).reduce((s, c) => s + c.charCodeAt(0), 0);
    return (4.6 + ((seed % 35) / 100)).toFixed(2);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="container py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <Badge variant="secondary" className="bg-card border border-border">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse mr-1.5" />
              19,000+ orders delivered • 4.9★ rating
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight">
              Premium subscriptions at <span className="text-primary">70% off.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              Get instant verified credentials for Netflix, ChatGPT, VPNs and more — shared legally with thousands of buyers across India.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/browse">Browse services <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/sell">Become a seller</Link>
              </Button>
            </div>
            {/* Trust pills */}
            <div className="flex flex-wrap gap-3 pt-2 text-xs">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5">
                <Lock className="h-3.5 w-3.5 text-primary" /> Secure wallet
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5">
                <Zap className="h-3.5 w-3.5 text-primary" /> Instant delivery
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-primary" /> Vetted vendors
              </div>
            </div>
            {/* Stat bar */}
            <div className="flex flex-wrap gap-6 pt-4 text-sm">
              <Stat icon={Users} label="Happy buyers" value="19,000+" />
              <div className="h-8 w-px bg-border" />
              <Stat icon={Star} label="Avg. rating" value="4.9 / 5" />
              <div className="h-8 w-px bg-border" />
              <Stat icon={IndianRupee} label="Saved by users" value="₹38L+" />
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
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{c.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="container py-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Featured services</h2>
            <p className="text-muted-foreground mt-1">Top picks from approved vendors.</p>
          </div>
          <Button variant="ghost" asChild><Link to="/browse">View all <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
        {products === null ? (
          <ProductGridSkeleton count={6} />
        ) : products.length === 0 ? (
          <div className="card-elevated p-12 text-center text-muted-foreground">
            No products yet — be the first vendor!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {products.map((p) => (
              <Link key={p.id} to={`/product/${p.id}`} className="card-elevated p-5 flex flex-col gap-3 group">
                <div className="aspect-video rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.service_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                  ) : (
                    <div className="text-3xl font-bold text-muted-foreground">{p.service_name.slice(0, 1)}</div>
                  )}
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{p.service_name}</div>
                    <div className="text-xs text-muted-foreground">{p.category}{p.duration ? ` • ${p.duration}` : ""}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-primary">{inr(p.display_price)}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 justify-end">
                      <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> {ratingFor(p.id)}
                    </div>
                  </div>
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

const Stat = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="flex items-center gap-2">
    <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
      <Icon className="h-4 w-4" />
    </div>
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-base font-bold">{value}</div>
    </div>
  </div>
);

export default Index;
