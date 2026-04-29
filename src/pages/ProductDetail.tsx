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
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    if (!id && !slug) return;
    setLoading(true);
    (async () => {
      const cols = "id,slug,service_name,category,description,display_price,duration,image_url,stock,seller_id,created_at,avg_rating,rating_count,delivery_mode,platform";
      const base = supabase.from("products").select(cols).eq("status", "approved" as any);
      const { data, error } = slug
        ? await base.eq("slug" as any, slug).maybeSingle()
        : await base.eq("id", id!).maybeSingle();
      if (error || !data) {
        toast.error("Product not found");
        navigate("/browse");
        return;
      }
      // Redirect /product/:id → /p/:slug for canonical clean URL
      const dataSlug = (data as any).slug as string | null | undefined;
      if (id && dataSlug) {
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-10">
        <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2">
          <Link to="/browse"><ChevronLeft className="h-4 w-4 mr-1" /> Back to browse</Link>
        </Button>

        <div className="grid md:grid-cols-2 gap-10">
          {/* Image */}
          <div className="card-elevated overflow-hidden aspect-square flex items-center justify-center bg-muted">
            {p.image_url ? (
              <img src={p.image_url} alt={p.service_name} className="w-full h-full object-cover" />
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
