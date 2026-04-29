import { useEffect, useState } from "react";
import { Bell, BellRing, Check, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [permAsked, setPermAsked] = useState(false);

  const unread = items.filter((n) => !n.is_read).length;

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id,type,title,body,link,is_read,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data as Notif[]) ?? []);
  };

  // Initial fetch + realtime subscription
  useEffect(() => {
    if (!user) { setItems([]); return; }
    load();
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notif;
          setItems((prev) => [n, ...prev].slice(0, 30));
          setPulse(true);
          setTimeout(() => setPulse(false), 1500);
          // In-app toast
          toast(n.title, {
            description: n.body ?? undefined,
            action: n.link ? { label: "View", onClick: () => navigate(n.link!) } : undefined,
          });
          // Native browser notification (if granted & tab hidden)
          if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
            try {
              const notif = new Notification(n.title, { body: n.body ?? "", tag: n.id });
              notif.onclick = () => { window.focus(); if (n.link) navigate(n.link); };
            } catch {}
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notif;
          setItems((prev) => prev.map((x) => (x.id === n.id ? n : x)));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, navigate]);

  // Ask for browser notification permission once after user logs in
  useEffect(() => {
    if (!user || permAsked) return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      const t = setTimeout(() => {
        Notification.requestPermission().catch(() => {});
        setPermAsked(true);
      }, 4000);
      return () => clearTimeout(t);
    }
    setPermAsked(true);
  }, [user, permAsked]);

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  };

  const markAll = async () => {
    if (!user) return;
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
  };

  const handleClick = async (n: Notif) => {
    if (!n.is_read) await markRead(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10" aria-label="Notifications">
          {pulse ? (
            <BellRing className="h-5 w-5 animate-[wiggle_0.6s_ease-in-out_infinite]" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-0.5 -right-0.5 h-5 min-w-[20px] rounded-full px-1 text-[10px] flex items-center justify-center"
            >
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[350px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="font-semibold text-sm">Notifications</div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAll}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No notifications yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors flex gap-3 group",
                    !n.is_read && "bg-primary/5"
                  )}
                >
                  <div className={cn("mt-1.5 h-2 w-2 rounded-full flex-shrink-0",
                    n.is_read ? "bg-muted-foreground/30" : "bg-primary"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-sm leading-tight", !n.is_read && "font-semibold")}>
                      {n.title}
                    </div>
                    {n.body && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</div>
                  </div>
                  {!n.is_read && (
                    <Check className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
