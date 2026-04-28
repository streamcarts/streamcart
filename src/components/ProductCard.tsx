import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Star, BadgeCheck, Zap } from "lucide-react";
import { inr } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";

export type ProductCardProduct = {
  id: string;
  service_name: string;
  category: string;
  display_price: number;
  duration: string | null;
  image_url: string | null;
  stock?: number;
  description?: string | null;
};

// Deterministic synthetic rating per product (kept consistent app-wide)
export const ratingFor = (id: string) => 4.6 + ((Array.from(id).reduce((s, c) => s + c.charCodeAt(0), 0) % 35) / 100);

type Props = {
  product: ProductCardProduct;
  showActions?: boolean;
};

export const ProductCard = ({ product: p, showActions = true }: Props) => {
  const { add } = useCart();
  const navigate = useNavigate();
  const r = ratingFor(p.id).toFixed(2);
  const stock = p.stock ?? 99;

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
      to={`/product/${p.id}`}
      className="group bg-card border border-border rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30"
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
        <Badge className="absolute top-2 left-2 bg-card/95 text-foreground border border-border shadow-sm hover:bg-card">
          {p.category}
        </Badge>
        {stock <= 3 && stock > 0 && (
          <Badge className="absolute top-2 right-2 bg-warning text-warning-foreground border-0">
            Only {stock} left
          </Badge>
        )}
      </div>

      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight truncate">{p.service_name}</h3>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="font-medium text-foreground">{r}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-0.5 text-primary font-medium">
              <BadgeCheck className="h-3 w-3" /> Trusted
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-lg font-extrabold text-primary leading-none">{inr(p.display_price)}</div>
          {p.duration && <div className="text-[11px] text-muted-foreground mt-1">/ {p.duration}</div>}
        </div>
      </div>

      {showActions && (
        <div className="flex items-center gap-2 mt-1">
          <Button
            type="button"
            onClick={handleAdd}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <ShoppingCart className="h-3.5 w-3.5 mr-1.5" /> Cart
          </Button>
          <Button
            type="button"
            onClick={handleBuy}
            size="sm"
            className="flex-1"
          >
            <Zap className="h-3.5 w-3.5 mr-1.5" /> Access Now
          </Button>
        </div>
      )}
    </Link>
  );
};
