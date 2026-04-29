import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Listens for new order_chats where the current user is buyer or seller
 * and auto-navigates them to the chat page so the conversation opens
 * instantly — no need to click the notification.
 */
export const ChatAutoOpener = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const seenRef = useRef<Set<string>>(new Set());
  const locRef = useRef(location.pathname);

  useEffect(() => { locRef.current = location.pathname; }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    const uid = user.id;

    const handleNewChat = (orderId: string, role: "buyer" | "seller") => {
      if (!orderId || seenRef.current.has(orderId)) return;
      seenRef.current.add(orderId);

      const target = `/orders/chat/${orderId}`;
      // Already on this chat? skip.
      if (locRef.current === target) return;

      const msg = role === "seller"
        ? "🛒 Naya order aaya — chat khol raha hoon"
        : "💬 Seller se chat shuru ho rahi hai";

      toast.success(msg, {
        action: { label: "Open", onClick: () => navigate(target) },
      });
      // Auto-open after a short beat so user sees the toast context
      setTimeout(() => {
        if (locRef.current !== target) navigate(target);
      }, 600);
    };

    const channel = supabase
      .channel(`auto-open-chat-${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_chats", filter: `seller_id=eq.${uid}` },
        (payload: any) => handleNewChat(payload.new?.order_id, "seller")
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_chats", filter: `buyer_id=eq.${uid}` },
        (payload: any) => handleNewChat(payload.new?.order_id, "buyer")
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, navigate]);

  return null;
};

export default ChatAutoOpener;
