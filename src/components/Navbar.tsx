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
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard, LogOut, ShoppingBag, Store, Shield, TrendingUp,
  MessageSquareText, Menu, Compass, Gift, Info, RotateCcw, Package,
} from "lucide-react";
import { CartIcon } from "./CartIcon";
import { NotificationBell } from "./NotificationBell";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Navbar = () => {
  const { user, isAdmin, isSeller, signOut } = useAuth();
  const navigate = useNavigate();
  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) { setIsAffiliate(false); return; }
    supabase.from("affiliates").select("status").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setIsAffiliate(data?.status === "approved"));
  }, [user]);

  const go = (path: string) => { setOpen(false); navigate(path); };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <AnnouncementBanner />
      <div className="container flex h-16 items-center justify-between gap-2">
        <Link to="/" aria-label="StreamCart home" className="flex-shrink-0">
          <Logo />
        </Link>

        {/* Desktop nav */}
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

        <div className="flex items-center gap-1 sm:gap-2">
          <NotificationBell />
          <CartIcon />
          {!user ? (
            <>
              <Button variant="ghost" className="hidden sm:inline-flex" onClick={() => navigate("/auth")}>Sign in</Button>
              <Button className="hidden sm:inline-flex" onClick={() => navigate("/auth?mode=signup")}>Get started</Button>
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

          {/* Mobile hamburger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85%] sm:max-w-sm p-0 flex flex-col">
              <SheetHeader className="px-5 pt-5 pb-3 border-b border-border text-left">
                <SheetTitle className="text-base">Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex-1 overflow-y-auto px-2 py-3 text-sm">
                <MobileLink icon={Compass} label="Browse" onClick={() => go("/browse")} />
                {user && (
                  <>
                    <MobileLink icon={MessageSquareText} label="Messages" onClick={() => go("/messages")} />
                    <MobileLink icon={Gift} label="Refer & Earn" onClick={() => go("/buyer?tab=refer")} />
                    {isSeller ? (
                      <MobileLink icon={Package} label="My Listings" onClick={() => go("/seller?tab=listings")} />
                    ) : (
                      <MobileLink icon={ShoppingBag} label="My Orders" onClick={() => go("/buyer?tab=orders")} />
                    )}
                    <MobileLink icon={ShoppingBag} label="Buyer dashboard" onClick={() => go("/buyer")} />
                    {isSeller && <MobileLink icon={Store} label="Seller dashboard" onClick={() => go("/seller")} />}
                    {isAffiliate && <MobileLink icon={TrendingUp} label="Affiliate" onClick={() => go("/affiliate")} />}
                    {isAdmin && <MobileLink icon={Shield} label="Admin panel" onClick={() => go("/admin")} />}
                  </>
                )}
                {!isSeller && <MobileLink icon={Store} label="Become a seller" onClick={() => go("/sell")} />}
                <div className="my-2 h-px bg-border" />
                <MobileLink icon={Info} label="About" onClick={() => go("/about")} />
                <MobileLink icon={RotateCcw} label="Refund Policy" onClick={() => go("/refund")} />
              </nav>
              <div className="border-t border-border p-4 space-y-2">
                {!user ? (
                  <>
                    <Button className="w-full" onClick={() => go("/auth?mode=signup")}>Get started</Button>
                    <Button variant="outline" className="w-full" onClick={() => go("/auth")}>Sign in</Button>
                  </>
                ) : (
                  <Button variant="outline" className="w-full" onClick={async () => { await signOut(); go("/"); }}>
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

const MobileLink = ({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted text-left transition-colors"
  >
    <Icon className="h-4 w-4 text-muted-foreground" />
    <span className="font-medium">{label}</span>
  </button>
);
