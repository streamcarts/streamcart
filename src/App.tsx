import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import { RequireAuth } from "@/components/RequireAuth";
import { captureUrlReferrals } from "@/lib/refTracking";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import Browse from "./pages/Browse.tsx";
import ProductDetail from "./pages/ProductDetail.tsx";
import Cart from "./pages/Cart.tsx";
import Checkout from "./pages/Checkout.tsx";
import Success from "./pages/Success.tsx";
import Buyer from "./pages/Buyer.tsx";
import Sell from "./pages/Sell.tsx";
import Seller from "./pages/Seller.tsx";
import Admin from "./pages/Admin.tsx";
import Affiliate from "./pages/Affiliate.tsx";

const queryClient = new QueryClient();

const ReferralCapture = () => {
  useEffect(() => { captureUrlReferrals(); }, []);
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ReferralCapture />
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/browse" element={<Browse />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
              <Route path="/success" element={<RequireAuth><Success /></RequireAuth>} />
              <Route path="/buyer" element={<RequireAuth><Buyer /></RequireAuth>} />
              <Route path="/affiliate" element={<RequireAuth><Affiliate /></RequireAuth>} />
              <Route path="/sell" element={<RequireAuth><Sell /></RequireAuth>} />
              <Route path="/seller" element={<RequireAuth role="seller"><Seller /></RequireAuth>} />
              <Route path="/admin" element={<RequireAuth role="admin"><Admin /></RequireAuth>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
