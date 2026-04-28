import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";

export const CartIcon = () => {
  const { count } = useCart();
  return (
    <Link
      to="/cart"
      aria-label={`Cart with ${count} items`}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted transition-colors"
    >
      <ShoppingCart className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center animate-in zoom-in">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
};
