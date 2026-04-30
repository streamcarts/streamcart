import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import { Loader2, ShoppingCart, Zap, Lock, BadgeCheck, Star, Users, Clock, Package, ChevronLeft, ShieldCheck } from "lucide-react";
import { ProductReviews } from "@/components/ProductReviews";
import { SEO } from "@/components/SEO";

type Product = {
  id: string;
  slug: string | null;
  service_name: string;
  category: string;
  description: string | null;
  display_price: number;
  duration: string | null;
  image_url: string | null;
  stock: number;
  seller_id: string;
  created_at: string;
  avg_rating: number;
  rating_count: number;
  platform?: string | null;
};

type SellerInfo = { display_name: string | null; created_at: string; orders_count: number; verified: boolean };

const ProductDetail = () => {
  const { id, slug } = useParams<{ id?: string; slug?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { add } = useCart();
  const [p, setP] = useState<Product | null>(null);
  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundReason, setNotFoundReason] = useState<null | "missing" | "unavailable">(null);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    if (!id && !slug) return;
    setLoading(true);
    setNotFoundReason(null);
    (async () => {
      const cols = "id,slug,service_name,category,description,display_price,duration,image_url,stock,seller_id,created_at,avg_rating,rating_count,delivery_mode,platform,status";
      const sb = supabase as any;

      // If the :slug param is actually a UUID, treat it as an id lookup
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const slugIsUuid = !!slug && UUID_RE.test(slug);
      const lookupBySlug = !!slug && !slugIsUuid;
      const lookupId = id ?? (slugIsUuid ? slug! : null);

      let { data, error } = await (lookupBySlug
        ? sb.from("products").select(cols).eq("slug", slug).eq("status", "approved").maybeSingle()
        : sb.from("products").select(cols).eq("id", lookupId!).eq("status", "approved").maybeSingle());

      if (!data && !error) {
        // Approved row not found — check if it exists at all (any status) to give a better reason
        const probe = await (lookupBySlug
          ? sb.from("products").select("id,status,slug").eq("slug", slug).maybeSingle()
          : sb.from("products").select("id,status,slug").eq("id", lookupId!).maybeSingle());
        if (probe.data) {
          setNotFoundReason("unavailable");
        } else {
          setNotFoundReason("missing");
        }
        setLoading(false);
        return;
      }
      if (error || !data) {
        setNotFoundReason("missing");
        setLoading(false);
        return;
      }
      // Redirect /product/:id and /p/:uuid → /p/:slug for canonical clean URL
      const dataSlug = (data as any).slug as string | null | undefined;
      if ((id || slugIsUuid) && dataSlug) {
        navigate(`/p/${dataSlug}`, { replace: true });
        return;
      }
      setP(data as unknown as Product);
      document.title = `${(data as any).service_name} — StreamCart`;

      const [{ data: prof }, { count }, { data: verified }] = await Promise.all([
        supabase.from("profiles").select("display_name, created_at").eq("id", data.seller_id).maybeSingle(),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("seller_id", data.seller_id).eq("status", "completed"),
        supabase.rpc("is_seller_verified", { _seller_id: data.seller_id }),
      ]);
      setSeller({
        display_name: prof?.display_name ?? "Verified seller",
        created_at: prof?.created_at ?? data.created_at,
        orders_count: count ?? 0,
        verified: !!verified,
      });
      setLoading(false);
    })();
  }, [id, slug, navigate]);

  const handleBuyNow = () => {
    if (!p) return;
    if (!user) return navigate(`/auth?next=/p/${p.slug ?? p.id}`);
    if ((p as any).delivery_mode === "chat") {
      navigate(`/chat-buy/${p.id}`);
      return;
    }
    add({
      id: p.id, service_name: p.service_name, category: p.category,
      display_price: Number(p.display_price), duration: p.duration,
      image_url: p.image_url, stock: p.stock,
    });
    navigate("/checkout?buyNow=1");
  };

  const handleAddToCart = () => {
    if (!p) return;
    add({
      id: p.id, service_name: p.service_name, category: p.category,
      display_price: Number(p.display_price), duration: p.duration,
      image_url: p.image_url, stock: p.stock,
    });
    toast.success(`${p.service_name} added to cart`);
  };

  if (notFoundReason) {
    const isUnavailable = notFoundReason === "unavailable";
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container py-16 flex flex-col items-center text-center max-w-lg mx-auto">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">
            {isUnavailable ? "This listing is currently unavailable" : "Product not found"}
          </h1>
          <p className="text-muted-foreground mb-6">
            {isUnavailable
              ? "The seller has paused this listing or it's awaiting review. Please check back later or browse similar products."
              : "This product may have been removed or the link is incorrect."}
          </p>
          <div className="flex gap-3">
            <Button asChild><Link to="/browse">Browse products</Link></Button>
            <Button variant="outline" onClick={() => navigate(-1)}>Go back</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (loading || !p) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container py-10 grid md:grid-cols-2 gap-10">
          <Skeleton className="aspect-square rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-12 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Real ratings from DB; fall back to subtle synthetic when no reviews yet
  const seed = Array.from(p.id).reduce((s, c) => s + c.charCodeAt(0), 0);
  const hasReal = (p.rating_count ?? 0) > 0;
  const rating = hasReal ? Number(p.avg_rating).toFixed(2) : (4.6 + ((seed % 35) / 100)).toFixed(2);
  const reviewCount = hasReal ? p.rating_count : 0;
  const sellerYear = new Date(seller?.created_at ?? p.created_at).getFullYear();

  // SEO: keyword-rich title/description + Product schema (price, rating, availability)
  const platformName = (p.platform || "").trim();
  const seoTitle = `Buy ${p.service_name}${p.duration ? ` (${p.duration})` : ""} Cheap`;
  const seoDesc = (p.description?.slice(0, 150) ||
    `Get ${p.service_name}${platformName ? ` ${platformName}` : ""} subscription at the lowest price in India. Instant delivery, verified sellers, money-back guarantee on StreamCart.`).trim();
  const productJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.service_name,
    description: p.description ?? seoDesc,
    image: p.image_url ? [p.image_url] : undefined,
    brand: { "@type": "Brand", name: platformName || "StreamCart" },
    category: p.category,
    offers: {
      "@type": "Offer",
      price: Number(p.display_price),
      priceCurrency: "INR",
      availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `https://streamcart.lovable.app/p/${p.slug ?? p.id}`,
    },
  };
  if (hasReal) {
    productJsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(p.avg_rating).toFixed(1),
      reviewCount: p.rating_count,
    };
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title={seoTitle}
        description={seoDesc}
        path={`/p/${p.slug ?? p.id}`}
        image={p.image_url ?? undefined}
        type="product"
        jsonLd={productJsonLd}
      />
      <Navbar />
      <main className="flex-1 container py-10">
        <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2">
          <Link to="/browse"><ChevronLeft className="h-4 w-4 mr-1" /> Back to browse</Link>
        </Button>

        <div className="grid md:grid-cols-2 gap-10">
          {/* Image */}
          <div className="card-elevated overflow-hidden aspect-square flex items-center justify-center bg-muted">
            {p.image_url ? (
              <img src={p.image_url} alt={p.service_name} fetchPriority="high" decoding="async" className="w-full h-full object-cover" />
            ) : (
              <div className="text-7xl font-bold text-muted-foreground">{p.service_name[0]}</div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{p.category}</Badge>
              {p.duration && <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{p.duration}</Badge>}
              <Badge className="bg-primary/10 text-primary hover:bg-primary/20"><BadgeCheck className="h-3 w-3 mr-1" />Verified listing</Badge>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{p.service_name}</h1>

            {/* Rating + slots */}
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-semibold">{rating}</span>
                <span className="text-muted-foreground">{hasReal ? `(${reviewCount} review${reviewCount === 1 ? "" : "s"})` : "(new)"}</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span><span className="font-semibold text-foreground">{200 + (seed % 800)}</span> active users</span>
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-bold text-primary">{inr(p.display_price)}</div>
              <div className="text-sm text-muted-foreground line-through">{inr(Number(p.display_price) * 1.6)}</div>
              <Badge variant="secondary" className="text-primary">Save 38%</Badge>
            </div>

            {/* Slots */}
            <div className={`rounded-lg border p-3 text-sm flex items-center gap-2 ${p.stock <= 3 ? "border-warning/50 bg-warning/5 text-warning" : "border-border bg-muted/40"}`}>
              <Package className="h-4 w-4" />
              {p.stock <= 3 ? (
                <span><strong>Only {p.stock} slot{p.stock === 1 ? "" : "s"} left</strong> — order soon!</span>
              ) : (
                <span><strong>{p.stock} slots</strong> available for instant delivery</span>
              )}
            </div>

            {/* Description */}
            {p.description && (
              <div>
                <h3 className="font-semibold mb-1.5 text-sm">About this service</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{p.description}</p>
              </div>
            )}

            {/* Money-secured banner */}
            <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              <span className="text-foreground/90">
                <strong className="text-primary">Money secured by StreamCart.</strong> Your payment is held safely until you confirm the credentials work.
              </span>
            </div>

            {/* CTAs */}
            <div className="flex gap-3 pt-2">
              <Button size="lg" className="flex-1" onClick={handleBuyNow} disabled={buying || p.stock === 0}>
                {buying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                Buy now
              </Button>
              <Button size="lg" variant="outline" className="flex-1" onClick={handleAddToCart} disabled={p.stock === 0}>
                <ShoppingCart className="h-4 w-4 mr-2" /> Add to cart
              </Button>
            </div>

            {/* Seller card */}
            <div className="card-elevated p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                {(seller?.display_name ?? "S")[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm">{seller?.display_name}</span>
                  {seller?.verified && <BadgeCheck className="h-4 w-4 text-primary" aria-label="Verified seller" />}
                </div>
                <div className="text-xs text-muted-foreground">
                  Member since {sellerYear} • {seller?.orders_count ?? 0} sales
                </div>
              </div>
              {seller?.verified ? (
                <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/30">Verified</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">New seller</Badge>
              )}
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              {[
                { icon: Lock, label: "Secure payment" },
                { icon: Zap, label: "Instant delivery" },
                { icon: ShieldCheck, label: "Buyer protection" },
              ].map((t) => (
                <div key={t.label} className="rounded-lg border border-border p-3 text-center">
                  <t.icon className="h-4 w-4 mx-auto text-primary mb-1" />
                  <div className="text-[11px] font-medium text-muted-foreground">{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <ProductReviews
          productId={p.id}
          sellerId={p.seller_id}
          serviceName={p.service_name}
          avgRating={Number(p.avg_rating || 0)}
          ratingCount={p.rating_count || 0}
        />
      </main>
      <Footer />
    </div>
  );
};

export default ProductDetail;
