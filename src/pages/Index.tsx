import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tv, Brain, Shield, Share2, ArrowRight, CheckCircle2, Lock, Zap, Star,
  Users, IndianRupee, BadgeCheck, Search, Gamepad2, Cloud, GraduationCap, Palette,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import { ProductGridSkeleton } from "@/components/ProductCardSkeleton";
import { ProductCard } from "@/components/ProductCard";

const categories = [
  { name: "AI Tools", icon: Brain, color: "bg-violet-100 text-violet-700" },
  { name: "OTT", icon: Tv, color: "bg-rose-100 text-rose-700" },
  { name: "Design", icon: Palette, color: "bg-pink-100 text-pink-700" },
  { name: "Games", icon: Gamepad2, color: "bg-amber-100 text-amber-700" },
  { name: "VPN", icon: Shield, color: "bg-sky-100 text-sky-700" },
  { name: "Cloud", icon: Cloud, color: "bg-indigo-100 text-indigo-700" },
  { name: "Education", icon: GraduationCap, color: "bg-emerald-100 text-emerald-700" },
  { name: "SMM", icon: Share2, color: "bg-orange-100 text-orange-700" },
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
  const [q, setQ] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "StreamCart — Short-term access to your favorite subscriptions";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Buy verified short-term access to Netflix, ChatGPT, VPN and more. Instant delivery, secure wallet, vetted vendors.");
    supabase
      .from("products")
      .select("id, service_name, category, display_price, duration, image_url")
      .eq("status", "approved")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => setProducts((data as Product[]) ?? []));
  }, []);

  const suggestions = useMemo(() => {
    if (!q.trim() || !products) return [];
    const t = q.toLowerCase();
    return products.filter((p) => p.service_name.toLowerCase().includes(t)).slice(0, 5);
  }, [q, products]);

  const submitSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    navigate(q.trim() ? `/browse?q=${encodeURIComponent(q.trim())}` : "/browse");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border" style={{ background: "var(--gradient-hero)" }}>
        <div className="container py-16 md:py-24 flex flex-col items-center text-center max-w-4xl">
          <Badge variant="secondary" className="bg-card border border-border mb-6 animate-fade-in">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse mr-1.5" />
            19,000+ orders delivered · 4.9★ trusted marketplace
          </Badge>

          <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight animate-fade-in">
            Get short-term access to your <span className="text-primary">favorite subscriptions</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-2xl animate-fade-in">
            Netflix, ChatGPT, Adobe, VPNs and more — shared legally at up to 70% off, delivered instantly.
          </p>

          {/* Search bar */}
          <form onSubmit={submitSearch} className="relative mt-8 w-full max-w-2xl animate-fade-in">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
              placeholder="Search Netflix, ChatGPT, Prime, NordVPN…"
              className="h-14 pl-14 pr-32 rounded-2xl text-base shadow-md border-border bg-card focus-visible:ring-primary"
            />
            <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-5 rounded-xl">
              Search
            </Button>

            {showSuggest && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-lg p-2 z-30 text-left">
                {suggestions.map((s) => (
                  <Link
                    key={s.id}
                    to={`/product/${s.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted text-sm transition-colors"
                  >
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {s.image_url ? (
                        <img src={s.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-bold text-muted-foreground">{s.service_name[0]}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{s.service_name}</div>
                      <div className="text-xs text-muted-foreground">{s.category}</div>
                    </div>
                    <div className="text-sm font-semibold text-primary">{inr(s.display_price)}</div>
                  </Link>
                ))}
              </div>
            )}
          </form>

          {/* Stat bar */}
          <div className="mt-8 flex flex-wrap justify-center items-center gap-6 md:gap-10 animate-fade-in">
            <Stat icon={Users} label="Happy buyers" value="19,000+" />
            <div className="hidden sm:block h-8 w-px bg-border" />
            <Stat icon={Star} label="Avg. rating" value="4.9 / 5" />
            <div className="hidden sm:block h-8 w-px bg-border" />
            <Stat icon={IndianRupee} label="Saved by users" value="₹38L+" />
          </div>

          {/* Trust pills */}
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs">
            <TrustPill icon={Lock} label="Secure wallet" />
            <TrustPill icon={Zap} label="Instant delivery" />
            <TrustPill icon={BadgeCheck} label="Vetted vendors" />
          </div>
        </div>
      </section>

      {/* CATEGORY ICON BAR */}
      <section className="border-b border-border bg-card/50">
        <div className="container py-6">
          <div className="flex gap-3 md:gap-5 overflow-x-auto no-scrollbar pb-1">
            {categories.map((c) => (
              <Link
                key={c.name}
                to={`/browse?cat=${encodeURIComponent(c.name)}`}
                className="group flex flex-col items-center gap-2 min-w-[88px] flex-shrink-0"
              >
                <div className={`h-16 w-16 rounded-full ${c.color} flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:shadow-md`}>
                  <c.icon className="h-7 w-7" />
                </div>
                <span className="text-xs font-medium text-foreground/80 group-hover:text-primary transition-colors">{c.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="container py-14">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Featured services</h2>
            <p className="text-muted-foreground mt-1">Top picks from approved vendors.</p>
          </div>
          <Button variant="ghost" asChild className="text-primary hover:text-primary">
            <Link to="/browse">View all <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
        {products === null ? (
          <ProductGridSkeleton count={8} />
        ) : products.length === 0 ? (
          <div className="card-elevated p-12 text-center text-muted-foreground">
            No products yet — be the first vendor!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      {/* TRUST */}
      <section className="container pb-16">
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon: Zap, title: "Instant delivery", desc: "Credentials revealed in your dashboard the moment you pay." },
            { icon: Lock, title: "Wallet protected", desc: "Funds stay in your wallet until you choose what to buy." },
            { icon: CheckCircle2, title: "Vetted vendors", desc: "Every seller and listing is reviewed by our admin team." },
          ].map((f) => (
            <div key={f.title} className="bg-card border border-border rounded-2xl p-6 transition-all hover:shadow-md hover:border-primary/30">
              <div className="h-11 w-11 rounded-xl bg-accent text-accent-foreground flex items-center justify-center mb-4">
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
  <div className="flex items-center gap-2.5">
    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
      <Icon className="h-4 w-4" />
    </div>
    <div className="text-left">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-base font-bold">{value}</div>
    </div>
  </div>
);

const TrustPill = ({ icon: Icon, label }: { icon: any; label: string }) => (
  <div className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5">
    <Icon className="h-3.5 w-3.5 text-primary" /> {label}
  </div>
);

export default Index;
