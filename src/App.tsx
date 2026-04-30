import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import { RequireAuth } from "@/components/RequireAuth";
import { ScrollToTop } from "@/components/ScrollToTop";
import { captureUrlReferrals } from "@/lib/refTracking";
import Index from "./pages/Index.tsx";
import { ChatAutoOpener } from "./components/ChatAutoOpener";

// Lazy-loaded routes — keeps the initial bundle tiny so the home page paints fast
// on mobile networks. React.lazy + dynamic import lets Vite split each page into
// its own chunk and load it only when navigated to.
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Browse = lazy(() => import("./pages/Browse.tsx"));
const ProductDetail = lazy(() => import("./pages/ProductDetail.tsx"));
const Cart = lazy(() => import("./pages/Cart.tsx"));
const Checkout = lazy(() => import("./pages/Checkout.tsx"));
const Success = lazy(() => import("./pages/Success.tsx"));
const Buyer = lazy(() => import("./pages/Buyer.tsx"));
const Sell = lazy(() => import("./pages/Sell.tsx"));
const Seller = lazy(() => import("./pages/Seller.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const AdminEmailLogs = lazy(() => import("./pages/AdminEmailLogs.tsx"));
const Affiliate = lazy(() => import("./pages/Affiliate.tsx"));
const Terms = lazy(() => import("./pages/Terms.tsx"));
const Privacy = lazy(() => import("./pages/Privacy.tsx"));
const Refund = lazy(() => import("./pages/Refund.tsx"));
const About = lazy(() => import("./pages/About.tsx"));
const PendingOrder = lazy(() => import("./pages/PendingOrder.tsx"));
const SellerListChat = lazy(() => import("./pages/SellerListChat.tsx"));
const SellerListPack = lazy(() => import("./pages/SellerListPack.tsx"));
const OrderChat = lazy(() => import("./pages/OrderChat.tsx"));
const ChatProductCheckout = lazy(() => import("./pages/ChatProductCheckout.tsx"));
const Messages = lazy(() => import("./pages/Messages.tsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cut redundant network chatter — pages keep their data when the user
      // tabs away or briefly navigates back, which feels noticeably snappier.
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ReferralCapture = () => {
  useEffect(() => { captureUrlReferrals(); }, []);
  return null;
};

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <ReferralCapture />
        <AuthProvider>
          <CartProvider>
            <ChatAutoOpener />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/browse" element={<Browse />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/p/:slug" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
                <Route path="/success" element={<RequireAuth><Success /></RequireAuth>} />
                <Route path="/buyer" element={<RequireAuth><Buyer /></RequireAuth>} />
                <Route path="/affiliate" element={<RequireAuth><Affiliate /></RequireAuth>} />
                <Route path="/sell" element={<RequireAuth><Sell /></RequireAuth>} />
                <Route path="/seller" element={<RequireAuth role="seller"><Seller /></RequireAuth>} />
                <Route path="/admin" element={<RequireAuth role="team"><Admin /></RequireAuth>} />
                <Route path="/admin/email-logs" element={<RequireAuth role="team"><AdminEmailLogs /></RequireAuth>} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/refund" element={<Refund />} />
                <Route path="/about" element={<About />} />
                <Route path="/orders/pending/:id" element={<RequireAuth><PendingOrder /></RequireAuth>} />
                <Route path="/seller/list-chat" element={<RequireAuth role="seller"><SellerListChat /></RequireAuth>} />
                <Route path="/seller/list-pack" element={<RequireAuth role="seller"><SellerListPack /></RequireAuth>} />
                <Route path="/orders/chat/:orderId" element={<RequireAuth><OrderChat /></RequireAuth>} />
                <Route path="/messages" element={<RequireAuth><Messages /></RequireAuth>} />
                <Route path="/chat-buy/:id" element={<ChatProductCheckout />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
