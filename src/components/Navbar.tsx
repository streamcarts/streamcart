import { Link, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LayoutDashboard, LogOut, ShoppingBag, Store, Shield, TrendingUp, MessageSquareText } from "lucide-react";
import { CartIcon } from "./CartIcon";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Navbar = () => {
  const { user, isAdmin, isSeller, signOut } = useAuth();
  const navigate = useNavigate();
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();
  const [isAffiliate, setIsAffiliate] = useState(false);

  useEffect(() => {
    if (!user) { setIsAffiliate(false); return; }
    supabase.from("affiliates").select("status").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setIsAffiliate(data?.status === "approved"));
  }, [user]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <AnnouncementBanner />
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" aria-label="StreamCart home">
          <Logo />
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <Link to="/browse" className="hover:text-foreground transition-colors">Browse</Link>
          {!user && (
            <>
              <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
              <Link to="/refund" className="hover:text-foreground transition-colors">Refund Policy</Link>
            </>
          )}
          {!isSeller && (
            <Link to="/sell" className="hover:text-foreground transition-colors">Become a seller</Link>
          )}
          {user && (
            <>
              <Link to="/messages" className="hover:text-foreground transition-colors">Messages</Link>
              <Link to="/buyer?tab=refer" className="hover:text-foreground transition-colors">Refer & Earn</Link>
              {isSeller ? (
                <Link to="/seller?tab=listings" className="hover:text-foreground transition-colors">My Listings</Link>
              ) : (
                <Link to="/buyer?tab=orders" className="hover:text-foreground transition-colors">Orders</Link>
              )}
            </>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <CartIcon />
          {!user ? (
            <>
              <Button variant="ghost" onClick={() => navigate("/auth")}>Sign in</Button>
              <Button onClick={() => navigate("/auth?mode=signup")}>Get started</Button>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 w-10 rounded-full p-0">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/buyer")}>
                  <ShoppingBag className="mr-2 h-4 w-4" /> Buyer dashboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/messages")}>
                  <MessageSquareText className="mr-2 h-4 w-4" /> Messages
                </DropdownMenuItem>
                {isSeller && (
                  <DropdownMenuItem onClick={() => navigate("/seller")}>
                    <Store className="mr-2 h-4 w-4" /> Seller dashboard
                  </DropdownMenuItem>
                )}
                {isAffiliate && (
                  <DropdownMenuItem onClick={() => navigate("/affiliate")}>
                    <TrendingUp className="mr-2 h-4 w-4" /> Affiliate dashboard
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    <Shield className="mr-2 h-4 w-4" /> Admin panel
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate("/sell")}>
                  <LayoutDashboard className="mr-2 h-4 w-4" /> Apply to sell
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await signOut(); navigate("/"); }}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
};
