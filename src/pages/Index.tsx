import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tv, Brain, Shield, Share2, ArrowRight, CheckCircle2, Lock, Zap, Star,
  Users, IndianRupee, BadgeCheck, Search, Gamepad2, Cloud, GraduationCap, Palette, Rocket, Quote, HelpCircle,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import { ProductGridSkeleton } from "@/components/ProductCardSkeleton";
import { ProductCard } from "@/components/ProductCard";
import { PopularPlatforms } from "@/components/PopularPlatforms";
import { SEO } from "@/components/SEO";
import { useCategories, getCategoryIcon } from "@/lib/categories";

type Product = {
  id: string;
  service_name: string;
  category: string;
  display_price: number;
  duration: string | null;
  image_url: string | null;
  sale_ends_at?: string | null;
};

// Curated "highest sell-through" picks — shown front and center on home
const TRENDING_KEYWORDS = [
  "Netflix", "ChatGPT", "Prime", "Spotify", "Hotstar",
  "YouTube", "Canva", "Adobe", "NordVPN", "JioSaavn",
];

type Review = { name: string; role: string; text: string };
type Faq = { q: string; a: string };

const reviewsList: Review[] = [
  { name: "Aarav Sharma", role: "Bengaluru · Buyer since 2024", text: "Got Netflix Premium for ₹70/month. Credentials worked instantly and the dashboard makes everything super clean." },
  { name: "Priya Mehta", role: "Mumbai · Power buyer", text: "I've placed 12 orders so far. Whenever something glitched, support refunded me to wallet within an hour. 10/10." },
  { name: "Rohit Verma", role: "Delhi · Verified seller", text: "Selling on StreamCart is honestly easier than running my own page. Auto-delivery + admin moderation = zero headache." },
];

const faqsList: Faq[] = [
  { q: "How does StreamCart work?", a: "Pick a subscription you need (e.g. Netflix, ChatGPT), pay using wallet/UPI, and the seller's verified credentials are revealed instantly in your buyer dashboard." },
  { q: "Is this legal?", a: "Yes. Many platforms officially allow shared profiles (Prime, Disney+, ChatGPT teams etc.). Sellers list slots they legally own; we never list services that disallow sharing." },
  { q: "What if my access stops working?", a: "Open the order in your dashboard and click Raise Ticket. Approved refunds are credited back to your StreamCart wallet, usually within a few hours." },
  { q: "How fast is delivery?", a: "Most orders are delivered in under 5 seconds — the moment payment is confirmed, the credentials appear in your dashboard." },
  { q: "Can I become a seller?", a: "Absolutely. Click Start Selling, fill the short application, and our team approves verified vendors within 24 hours." },
  { q: "How are payments secured?", a: "Payments flow through your wallet, which is encrypted at rest. Card and UPI processing happens through PCI-DSS compliant payment gateways." },
];

type LiveStats = { orders: number; sellers: number; avgRating: number; ratingCount: number };

const Index = () => {
  const { cats } = useCategories({ activeOnly: true });
  const [products, setProducts] = useState<Product[] | null>(null);
  const [searchIndex, setSearchIndex] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "StreamCart — Short-term access to your favorite subscriptions";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Buy verified short-term access to Netflix, ChatGPT, VPN and more. Instant delivery, secure wallet, vetted vendors.");

    // Featured products (cards on home)
    supabase
      .from("products")
      .select("id, service_name, category, display_price, duration, image_url, sale_ends_at")
      .eq("status", "approved")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => setProducts((data as Product[]) ?? []));

    // Full search index — every approved product, lightweight columns
    supabase
      .from("products")
      .select("id, service_name, category, display_price, duration, image_url, sale_ends_at")
      .eq("status", "approved")
      .eq("is_active", true)
      .gt("stock", 0)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => setSearchIndex((data as Product[]) ?? []));

    // Live trust stats — counts only, no row data
    (async () => {
      const [ordersRes, sellersRes, reviewsRes] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "seller"),
        supabase.from("reviews").select("rating"),
      ]);
      const ratings = (reviewsRes.data ?? []) as { rating: number }[];
      const avg = ratings.length ? ratings.reduce((s, r) => s + (r.rating || 0), 0) / ratings.length : 0;
      setStats({
        orders: ordersRes.count ?? 0,
        sellers: sellersRes.count ?? 0,
        avgRating: Math.round(avg * 10) / 10,
        ratingCount: ratings.length,
      });
    })();
  }, []);

  const suggestions = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) {
      // On focus with empty input → show popular categories shortcut list
      return searchIndex.slice(0, 5);
    }
    return searchIndex
      .filter((p) =>
        p.service_name.toLowerCase().includes(t) ||
        p.category.toLowerCase().includes(t)
      )
      .slice(0, 6);
  }, [q, searchIndex]);

  // Trending now: products whose name matches our hot-keyword list
  const trendingPicks = useMemo(() => {
    const matched: Product[] = [];
    const seen = new Set<string>();
    for (const kw of TRENDING_KEYWORDS) {
      const k = kw.toLowerCase();
      const hit = searchIndex.find(
        (p) => !seen.has(p.id) && p.service_name.toLowerCase().includes(k),
      );
      if (hit) {
        matched.push(hit);
        seen.add(hit.id);
      }
    }
    return matched.slice(0, 8);
  }, [searchIndex]);

  // Reset highlight when suggestions change
  useEffect(() => { setActiveIdx(-1); }, [q, showSuggest]);

  const submitSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    // If the user has highlighted a suggestion via keyboard, open it directly
    if (activeIdx >= 0 && suggestions[activeIdx]) {
      navigate(`/product/${suggestions[activeIdx].id}`);
      return;
    }
    navigate(q.trim() ? `/browse?q=${encodeURIComponent(q.trim())}` : "/browse");
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggest || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setShowSuggest(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "StreamCart",
          url: "https://streamcart.lovable.app",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://streamcart.lovable.app/browse?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }}
      />
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border" style={{ background: "var(--gradient-hero)" }}>
        <div className="container py-16 md:py-24 flex flex-col items-center text-center max-w-4xl">
          {/* Highlight badge */}
          <Badge variant="secondary" className="bg-card border border-primary/20 text-primary mb-6 px-3.5 py-1.5 animate-fade-in shadow-sm">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse mr-1.5" />
            New on StreamCart — verified sellers only
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
          <form onSubmit={submitSearch} className="relative mt-8 w-full max-w-2xl animate-fade-in z-40">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => setTimeout(() => setShowSuggest(false), 180)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search Netflix, ChatGPT, Prime, NordVPN…"
              className="h-14 pl-14 pr-32 rounded-2xl text-base shadow-md border-border bg-card focus-visible:ring-primary"
              aria-autocomplete="list"
              aria-expanded={showSuggest}
            />
            <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-5 rounded-xl">
              Search
            </Button>

            {showSuggest && (
              <div
                className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-2xl shadow-2xl z-50 text-left overflow-hidden"
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border bg-muted/40">
                  {q.trim() ? `Results for “${q.trim()}”` : "Popular right now"}
                </div>

                {suggestions.length > 0 ? (
                  <ul className="p-2 max-h-80 overflow-y-auto">
                    {suggestions.map((s, i) => (
                      <li key={s.id}>
                        <Link
                          to={`/product/${s.id}`}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                            i === activeIdx ? "bg-accent" : "hover:bg-muted"
                          }`}
                          onMouseEnter={() => setActiveIdx(i)}
                        >
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                            {s.image_url ? (
                              <img src={s.image_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-bold text-muted-foreground">{s.service_name[0]}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-medium">{s.service_name}</div>
                            <div className="text-xs text-muted-foreground">{s.category}{s.duration ? ` • ${s.duration}` : ""}</div>
                          </div>
                          <div className="text-sm font-semibold text-primary flex-shrink-0">{inr(s.display_price)}</div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No matches for <span className="font-medium text-foreground">"{q}"</span>.
                    <div className="mt-2 text-xs">Try a different keyword or browse all services.</div>
                  </div>
                )}

                {q.trim() && (
                  <Link
                    to={`/browse?q=${encodeURIComponent(q.trim())}`}
                    className="flex items-center justify-between px-4 py-3 border-t border-border text-sm font-medium text-primary hover:bg-accent transition-colors"
                  >
                    <span className="inline-flex items-center gap-2"><Search className="h-4 w-4" /> Search all services for "{q.trim()}"</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
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
            <Stat icon={Lock} label="Escrow protected" value="100%" />
            <div className="hidden sm:block h-8 w-px bg-border" />
            <Stat icon={CheckCircle2} label="Orders delivered" value={(1845 + (stats?.orders ?? 0)).toLocaleString() + "+"} />
            <div className="hidden sm:block h-8 w-px bg-border" />
            <Stat icon={Zap} label="Chat delivery" value="Under 30 min" />
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-b border-border bg-card">
        <div className="container py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
            <TrustBadge icon={Star} label="Quality-checked" sub="Approved listings only" tone="amber" />
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
        {cats.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-dashed border-border rounded-2xl p-8 text-center">
            No categories yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {cats.map((c) => {
              const Icon = getCategoryIcon(c.icon);
              return (
                <Link
                  key={c.id}
                  to={`/browse?cat=${encodeURIComponent(c.name)}`}
                  className="group bg-card border border-border rounded-2xl p-5 flex items-center gap-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30"
                >
                  <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center transition-transform duration-200 group-hover:scale-110 flex-shrink-0">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold leading-tight truncate group-hover:text-primary transition-colors">{c.name}</div>
                    {c.min_price > 0 && (
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">From ₹{c.min_price}</div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* TRENDING NOW — curated hot picks */}
      {trendingPicks.length > 0 && (
        <section className="container py-10">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold inline-flex items-center gap-2">
                🔥 Trending right now
              </h2>
              <p className="text-muted-foreground mt-1">The subscriptions Indians are buying most this week.</p>
            </div>
            <Button variant="ghost" asChild className="text-primary hover:text-primary">
              <Link to="/browse">See all <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {trendingPicks.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

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
              Be one of the first verified vendors on StreamCart and start earning today.
            </p>
            <Button asChild size="lg" className="mt-5 rounded-xl font-semibold">
              <Link to="/sell">Become a Seller</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
            {/* View all products CTA — replaces the empty space after the grid */}
            <div className="mt-10 flex justify-center">
              <Button asChild size="lg" variant="outline" className="h-12 px-8 rounded-2xl border-2 font-semibold hover:bg-accent hover:-translate-y-0.5 transition-all">
                <Link to="/browse">
                  View all products <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </>
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

      {/* REVIEWS */}
      <section className="bg-muted/40 border-y border-border">
        <div className="container py-16">
          <div className="text-center max-w-2xl mx-auto mb-10">
            {stats && stats.ratingCount > 0 ? (
              <Badge variant="secondary" className="bg-card border border-border mb-3">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400 mr-1" />
                {stats.avgRating.toFixed(1)} average from {stats.ratingCount.toLocaleString()} verified review{stats.ratingCount === 1 ? "" : "s"}
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-card border border-border mb-3">
                <BadgeCheck className="h-3 w-3 text-primary mr-1" /> Verified buyers · Real reviews
              </Badge>
            )}
            <h2 className="text-2xl md:text-3xl font-bold">Loved by users across India</h2>
            <p className="text-muted-foreground mt-2">Real reviews from verified StreamCart buyers.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {reviewsList.map((rv) => (
              <div
                key={rv.name}
                className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
              >
                <Quote className="h-6 w-6 text-primary/40" />
                <div className="flex items-center gap-1">
                  {[0,1,2,3,4].map((i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed flex-1">"{rv.text}"</p>
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                    {rv.name.split(" ").map((s) => s[0]).join("").slice(0,2)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold leading-tight truncate">{rv.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{rv.role}</div>
                  </div>
                  <BadgeCheck className="h-4 w-4 text-primary ml-auto flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container py-16">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <div className="h-12 w-12 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
              <HelpCircle className="h-6 w-6" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold">Frequently asked questions</h2>
            <p className="text-muted-foreground mt-2">Everything you need to know before your first order.</p>
          </div>

          <Accordion type="single" collapsible className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {faqsList.map((faq, idx) => (
              <AccordionItem key={idx} value={`q${idx}`} className="border-0 px-5">
                <AccordionTrigger className="py-4 text-left text-base font-semibold hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Still have questions?{" "}
            <Link to="/buyer" className="text-primary font-medium hover:underline">Raise a support ticket</Link>
          </div>
        </div>
      </section>

      <Footer />

      {/* Mobile sticky CTA removed per request */}
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
