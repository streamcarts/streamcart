import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tv, Brain, Shield, Share2, ArrowRight, CheckCircle2, Lock, Zap, Star,
  Users, IndianRupee, BadgeCheck, Search, Gamepad2, Cloud, GraduationCap, Palette, Rocket,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import { ProductGridSkeleton } from "@/components/ProductCardSkeleton";
import { ProductCard } from "@/components/ProductCard";

const categories = [
  { name: "AI Tools", icon: Brain, color: "bg-violet-100 text-violet-700", desc: "ChatGPT, Claude, Midjourney" },
  { name: "OTT", icon: Tv, color: "bg-rose-100 text-rose-700", desc: "Netflix, Prime, Hotstar" },
  { name: "Design", icon: Palette, color: "bg-pink-100 text-pink-700", desc: "Adobe, Figma, Canva" },
  { name: "Games", icon: Gamepad2, color: "bg-amber-100 text-amber-700", desc: "Game Pass, PSN, Steam" },
  { name: "VPN", icon: Shield, color: "bg-sky-100 text-sky-700", desc: "Nord, Express, Surfshark" },
  { name: "Cloud", icon: Cloud, color: "bg-indigo-100 text-indigo-700", desc: "Drive, iCloud, Dropbox" },
  { name: "Education", icon: GraduationCap, color: "bg-emerald-100 text-emerald-700", desc: "Coursera, Udemy, LinkedIn" },
  { name: "SMM", icon: Share2, color: "bg-orange-100 text-orange-700", desc: "Followers, panels, analytics" },
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
          {/* Highlight badge */}
          <Badge variant="secondary" className="bg-card border border-primary/20 text-primary mb-6 px-3.5 py-1.5 animate-fade-in shadow-sm">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse mr-1.5" />
            Trusted by 19,000+ users
          </Badge>

          <h1 className="text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight animate-fade-in">
            Get Premium Subscriptions at <span className="text-primary">70% Lower Cost</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-2xl animate-fade-in">
            Netflix, ChatGPT, Adobe, VPNs and more — shared legally, delivered instantly to your dashboard.
          </p>

          {/* Urgency line */}
          <div className="mt-4 inline-flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-sm font-medium text-foreground/80 animate-fade-in">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" /> Limited slots</span>
            <span className="text-border">•</span>
            <span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-primary" /> Instant access</span>
            <span className="text-border">•</span>
            <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-primary" /> Verified sellers</span>
          </div>

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

          {/* Primary CTAs — bigger, higher contrast */}
          <div className="mt-7 flex flex-col sm:flex-row gap-3 w-full sm:w-auto animate-fade-in">
            <Button
              size="lg"
              asChild
              className="h-14 px-8 text-base font-bold rounded-2xl shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"
            >
              <Link to="/browse">Browse Subscriptions <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="h-14 px-8 text-base font-semibold rounded-2xl border-2 hover:bg-accent hover:-translate-y-0.5 transition-all"
            >
              <Link to="/sell">Start Selling</Link>
            </Button>
          </div>

          {/* Stat bar */}
          <div className="mt-10 flex flex-wrap justify-center items-center gap-6 md:gap-10 animate-fade-in">
            <Stat icon={Users} label="Happy buyers" value="19,000+" />
            <div className="hidden sm:block h-8 w-px bg-border" />
            <Stat icon={Star} label="Avg. rating" value="4.9 / 5" />
            <div className="hidden sm:block h-8 w-px bg-border" />
            <Stat icon={IndianRupee} label="Saved by users" value="₹38L+" />
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-b border-border bg-card">
        <div className="container py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
            <TrustBadge icon={Star} label="4.9 Rating" sub="From 5,200+ reviews" tone="amber" />
            <TrustBadge icon={Lock} label="Secure Payments" sub="UPI · Wallet · Cards" tone="primary" />
            <TrustBadge icon={Zap} label="Instant Delivery" sub="Credentials in 5s" tone="primary" />
            <TrustBadge icon={BadgeCheck} label="Verified Sellers" sub="Manually approved" tone="primary" />
          </div>
        </div>
      </section>

      {/* CATEGORY SECTION (bigger cards with descriptions) */}
      <section className="container py-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Shop by category</h2>
            <p className="text-muted-foreground mt-1">Premium services across every digital need.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {categories.map((c) => (
            <Link
              key={c.name}
              to={`/browse?cat=${encodeURIComponent(c.name)}`}
              className="group bg-card border border-border rounded-2xl p-5 flex items-center gap-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30"
            >
              <div className={`h-12 w-12 rounded-xl ${c.color} flex items-center justify-center transition-transform duration-200 group-hover:scale-110 flex-shrink-0`}>
                <c.icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold leading-tight truncate group-hover:text-primary transition-colors">{c.name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{c.desc}</div>
              </div>
            </Link>
          ))}
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
          <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center">
            <div className="h-14 w-14 mx-auto rounded-2xl bg-accent text-accent-foreground flex items-center justify-center mb-4">
              <Rocket className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold">No listings yet. Start selling and earn now 🚀</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
              Be one of the first verified vendors on StreamCart and reach 19,000+ ready buyers.
            </p>
            <Button asChild size="lg" className="mt-5 rounded-xl font-semibold">
              <Link to="/sell">Become a Seller</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      {/* TRUST / WHY US */}
      <section className="container pb-16">
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon: Zap, title: "Instant delivery", desc: "Credentials revealed in your dashboard the moment you pay.", tone: "bg-amber-100 text-amber-700" },
            { icon: Lock, title: "Wallet protected", desc: "Funds stay in your wallet until you choose what to buy.", tone: "bg-sky-100 text-sky-700" },
            { icon: CheckCircle2, title: "Vetted vendors", desc: "Every seller and listing is reviewed by our admin team.", tone: "bg-emerald-100 text-emerald-700" },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-card border border-border rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30"
            >
              <div className={`h-12 w-12 rounded-2xl ${f.tone} flex items-center justify-center mb-4 transition-transform duration-200 hover:scale-110`}>
                <f.icon className="h-5 w-5" />
              </div>
              <div className="font-semibold mb-1">{f.title}</div>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <Footer />

      {/* Mobile sticky CTA */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-md border-t border-border p-3 flex gap-2 shadow-lg">
        <Button variant="outline" asChild className="flex-1 h-12 rounded-xl font-semibold">
          <Link to="/sell">Sell</Link>
        </Button>
        <Button asChild className="flex-[2] h-12 rounded-xl font-bold shadow-md shadow-primary/30">
          <Link to="/browse">Browse Subscriptions <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
        </Button>
      </div>
      <div className="md:hidden h-20" aria-hidden />
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

const TrustBadge = ({ icon: Icon, label, sub, tone }: { icon: any; label: string; sub: string; tone: "primary" | "amber" }) => {
  const toneClass = tone === "amber" ? "bg-amber-100 text-amber-600" : "bg-primary/10 text-primary";
  return (
    <div className="flex items-center gap-3">
      <div className={`h-10 w-10 rounded-xl ${toneClass} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`h-5 w-5 ${tone === "amber" ? "fill-amber-400" : ""}`} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold leading-tight truncate">{label}</div>
        <div className="text-[11px] text-muted-foreground truncate">{sub}</div>
      </div>
    </div>
  );
};
export default Index;
