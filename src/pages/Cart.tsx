import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/format";
import { Minus, Plus, Trash2, ShoppingCart, Lock, Zap, BadgeCheck } from "lucide-react";

const Cart = () => {
  const { items, subtotal, setQty, remove, count } = useCart();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-10">
        <h1 className="text-3xl font-bold mb-2">Your cart</h1>
        <p className="text-muted-foreground mb-8">{count} {count === 1 ? "item" : "items"}</p>

        {items.length === 0 ? (
          <div className="card-elevated p-12 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="font-semibold mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground mb-6 text-sm">Add some services to get started.</p>
            <Button asChild><Link to="/browse">Browse services</Link></Button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-3">
              {items.map((it) => (
                <div key={it.id} className="card-elevated p-4 flex gap-4 items-center">
                  <div className="h-20 w-20 rounded-lg bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {it.image_url ? (
                      <img src={it.image_url} alt={it.service_name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-muted-foreground">{it.service_name[0]}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${it.id}`} className="font-semibold hover:text-primary transition-colors">{it.service_name}</Link>
                    <div className="text-xs text-muted-foreground">{it.category}{it.duration ? ` • ${it.duration}` : ""}</div>
                    <div className="text-sm font-bold text-primary mt-1">{inr(it.display_price)}</div>
                  </div>
                  <div className="flex items-center gap-1 border border-border rounded-lg">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setQty(it.id, it.qty - 1)} disabled={it.qty <= 1}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{it.qty}</span>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setQty(it.id, it.qty + 1)} disabled={it.qty >= it.stock}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove(it.id)} aria-label="Remove">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>

            <aside className="lg:col-span-1">
              <div className="card-elevated p-6 sticky top-24 space-y-4">
                <h2 className="font-semibold">Order summary</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal ({count} items)</span><span>{inr(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Service fee</span><span className="text-primary">Free</span>
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between font-bold text-base">
                    <span>Total</span><span>{inr(subtotal)}</span>
                  </div>
                </div>
                <Button className="w-full" size="lg" onClick={() => navigate("/checkout")}>
                  Proceed to checkout
                </Button>
                <div className="grid grid-cols-3 gap-2 pt-2 text-[10px] text-muted-foreground">
                  <div className="flex flex-col items-center gap-1"><Lock className="h-3.5 w-3.5 text-primary" /><span>Secure</span></div>
                  <div className="flex flex-col items-center gap-1"><Zap className="h-3.5 w-3.5 text-primary" /><span>Instant</span></div>
                  <div className="flex flex-col items-center gap-1"><BadgeCheck className="h-3.5 w-3.5 text-primary" /><span>Verified</span></div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Cart;
