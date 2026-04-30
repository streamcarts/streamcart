import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Star, BadgeCheck, Zap, Flame, Clock } from "lucide-react";
import { inr } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";

export type ProductCardProduct = {
  id: string;
  slug?: string | null;
  service_name: string;
  category: string;
  display_price: number;
  duration: string | null;
  image_url: string | null;
  stock?: number;
  description?: string | null;
  sale_ends_at?: string | null;
};

// Deterministic synthetic rating per product (kept consistent app-wide)
const sumChars = (id: string) => Array.from(id).reduce((s, c) => s + c.charCodeAt(0), 0);
export const ratingFor = (id: string) => 4.6 + ((sumChars(id) % 35) / 100);
// Deterministic synthetic review count (range ~120 – 2400)
export const reviewCountFor = (id: string) => 120 + (sumChars(id) * 7) % 2280;

// Deterministic "best seller" flag (~ top 35%)
const isBestSeller = (id: string) => (sumChars(id) % 100) < 35;

// Deterministic per-product sale end (next 6h–48h window) when none set on DB.
// Stable per id+day so it doesn't visibly "reset" on every render.
const fallbackSaleEnd = (id: string) => {
  const dayKey = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const hours = 6 + ((sumChars(id) + dayKey) % 42); // 6–47 hours
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return new Date(start.getTime() + hours * 60 * 60 * 1000);
};

const useCountdown = (target: Date | null) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target?.getTime()]);
  if (!target) return null;
  const diff = target.getTime() - now;
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { h, m, s };
};

type Props = {
  product: ProductCardProduct;
  showActions?: boolean;
};

export const ProductCard = ({ product: p, showActions = true }: Props) => {
  const { add } = useCart();
  const navigate = useNavigate();
  const r = ratingFor(p.id).toFixed(2);
  const stock = p.stock ?? 99;
  const bestSeller = isBestSeller(p.id);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    add({
      id: p.id, service_name: p.service_name, category: p.category,
      display_price: Number(p.display_price), duration: p.duration,
      image_url: p.image_url, stock,
    });
    toast.success(`${p.service_name} added to cart`);
  };

  const handleBuy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    add({
      id: p.id, service_name: p.service_name, category: p.category,
      display_price: Number(p.display_price), duration: p.duration,
      image_url: p.image_url, stock,
    });
    navigate("/checkout");
  };

  return (
    <Link
      to={`/p/${p.slug ?? p.id}`}
      className="group bg-card border border-border rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-primary/40"
    >
      {/* Image */}
      <div className="relative aspect-[16/10] rounded-xl bg-muted overflow-hidden flex items-center justify-center">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={p.service_name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="text-4xl font-bold text-muted-foreground/60">{p.service_name.slice(0, 1)}</span>
        )}

        {/* Top-left: Best Seller (priority) or Category */}
        {bestSeller ? (
          <Badge className="absolute top-2 left-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white border-0 shadow-md gap-1 hover:from-orange-500 hover:to-rose-500">
            <Flame className="h-3 w-3" /> Best Seller
          </Badge>
        ) : (
          <Badge className="absolute top-2 left-2 bg-card/95 text-foreground border border-border shadow-sm hover:bg-card">
            {p.category}
          </Badge>
        )}

        {/* Top-right: stock urgency */}
        {stock <= 3 && stock > 0 && (
          <Badge className="absolute top-2 right-2 bg-warning text-warning-foreground border-0">
            Only {stock} left
          </Badge>
        )}
      </div>

      {/* Title + Trusted Seller */}
      <div className="space-y-1.5">
        <h3 className="font-semibold leading-tight truncate">{p.service_name}</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span className="inline-flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="font-medium text-foreground">{r}</span>
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
            <BadgeCheck className="h-3 w-3" /> Trusted Seller
          </span>
        </div>
      </div>

      {/* Pricing row — bigger green price + clear duration */}
      <div className="flex items-end justify-between gap-2 pt-1">
        <div>
          <div className="text-2xl font-extrabold text-primary leading-none">{inr(p.display_price)}</div>
          {p.duration && <div className="text-xs text-muted-foreground mt-1.5">for {p.duration}</div>}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          inc. taxes
        </div>
      </div>

      {showActions && (
        <div className="flex items-center gap-2 mt-1">
          <Button
            type="button"
            onClick={handleAdd}
            variant="outline"
            size="sm"
            aria-label="Add to cart"
            className="h-11 w-11 p-0 flex-shrink-0 rounded-xl hover:bg-accent hover:border-primary/40 transition-all"
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            onClick={handleBuy}
            className="flex-1 h-11 rounded-xl text-sm font-bold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
          >
            <Zap className="h-4 w-4 mr-1.5" /> Access Now
          </Button>
        </div>
      )}
    </Link>
  );
};
