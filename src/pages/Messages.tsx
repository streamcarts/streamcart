import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { MessageSquareText, Search, ShieldAlert } from "lucide-react";
import { inr } from "@/lib/format";

type ChatRow = {
  id: string;
  order_id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  updated_at: string;
  buyer_last_read_at: string;
  seller_last_read_at: string;
  orders?: { id: string; service_name: string; total_paid: number; tier_label: string | null } | null;
  buyer?: { display_name: string | null; email: string | null } | null;
  seller?: { display_name: string | null; email: string | null } | null;
  last_msg?: { body: string | null; kind: string; created_at: string; sender_id: string | null } | null;
  unread_count: number;
};

const Messages = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => { document.title = "Messages — StreamCart"; }, []);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    const { data: chats } = await supabase
      .from("order_chats")
      .select("id, order_id, buyer_id, seller_id, status, updated_at, buyer_last_read_at, seller_last_read_at")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("updated_at", { ascending: false })
      .limit(100);

    const list = (chats ?? []) as ChatRow[];
    if (list.length === 0) { setRows([]); setLoading(false); return; }

    const orderIds = Array.from(new Set(list.map(c => c.order_id)));
    const userIds = Array.from(new Set(list.flatMap(c => [c.buyer_id, c.seller_id])));
    const chatIds = list.map(c => c.id);

    const [{ data: orders }, { data: profs }, { data: msgs }] = await Promise.all([
      supabase.from("orders").select("id, service_name, total_paid, tier_label").in("id", orderIds),
      supabase.from("profiles").select("id, display_name, email").in("id", userIds),
      supabase.from("chat_messages").select("chat_id, body, kind, created_at, sender_id").in("chat_id", chatIds).order("created_at", { ascending: false }),
    ]);

    const oMap = new Map((orders ?? []).map(o => [o.id, o]));
    const pMap = new Map((profs ?? []).map(p => [p.id, p]));
    const lastByChat = new Map<string, any>();
    const unreadByChat = new Map<string, number>();
    (msgs ?? []).forEach((m: any) => {
      if (!lastByChat.has(m.chat_id)) lastByChat.set(m.chat_id, m);
    });

    list.forEach(c => {
      const isBuyer = c.buyer_id === user.id;
      const lastRead = isBuyer ? c.buyer_last_read_at : c.seller_last_read_at;
      const cnt = (msgs ?? []).filter((m: any) =>
        m.chat_id === c.id &&
        m.sender_id && m.sender_id !== user.id &&
        new Date(m.created_at) > new Date(lastRead)
      ).length;
      unreadByChat.set(c.id, cnt);
    });

    const enriched = list.map(c => ({
      ...c,
      orders: oMap.get(c.order_id) as any ?? null,
      buyer: pMap.get(c.buyer_id) as any ?? null,
      seller: pMap.get(c.seller_id) as any ?? null,
      last_msg: lastByChat.get(c.id) ?? null,
      unread_count: unreadByChat.get(c.id) ?? 0,
    }));

    setRows(enriched);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  // Realtime: when any of my chats updates, reload
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`inbox-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_chats" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [user?.id]);

  const filtered = rows.filter(r => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    const other = r.buyer_id === user?.id ? r.seller : r.buyer;
    return (
      r.orders?.service_name?.toLowerCase().includes(s) ||
      other?.display_name?.toLowerCase().includes(s) ||
      other?.email?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-6 max-w-3xl">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquareText className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Messages</h1>
        </div>

        <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 mb-4 text-xs flex gap-2 items-start">
          <ShieldAlert className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div><strong>Stay safe.</strong> All communication must happen inside StreamCart. Sharing phone, WhatsApp, email or external links is auto-blocked and may lead to a permanent ban.</div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by service, buyer or seller…" className="pl-9" />
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0,1,2].map(i => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            No conversations yet. They'll appear here as soon as you place or receive a chat-delivery order.
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => {
              const isBuyer = r.buyer_id === user?.id;
              const other = isBuyer ? r.seller : r.buyer;
              const otherName = other?.display_name || other?.email?.split("@")[0] || (isBuyer ? "Seller" : "Buyer");
              const preview =
                !r.last_msg ? "No messages yet" :
                r.last_msg.kind === "credentials" ? "🔐 Credentials delivered" :
                r.last_msg.kind === "image" ? "🖼️ Image" :
                r.last_msg.kind === "system" ? r.last_msg.body :
                r.last_msg.body;
              return (
                <Link
                  key={r.id}
                  to={`/orders/chat/${r.order_id}`}
                  onClick={() => { /* read-mark happens inside detail page */ }}
                >
                  <Card className="p-3 hover:bg-muted/30 transition-colors flex gap-3 items-center">
                    <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
                      {otherName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold truncate">{otherName}</div>
                        <div className="text-[11px] text-muted-foreground shrink-0">
                          {r.last_msg ? new Date(r.last_msg.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground truncate mb-1">
                        {r.orders?.service_name}{r.orders?.tier_label ? ` • ${r.orders.tier_label}` : ""} • {inr(r.orders?.total_paid ?? 0)}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm text-muted-foreground truncate">{preview}</div>
                        {r.unread_count > 0 && (
                          <Badge className="bg-primary text-primary-foreground shrink-0">{r.unread_count}</Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Messages;
