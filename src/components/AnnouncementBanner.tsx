import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { X, Megaphone, AlertTriangle, CheckCircle2 } from "lucide-react";

type Anno = {
  id: string;
  title: string;
  body: string;
  variant: string;
  audience: string;
};

const DISMISS_KEY = "streamcart.anno.dismissed.v1";

export const AnnouncementBanner = () => {
  const { user, isSeller } = useAuth();
  const [items, setItems] = useState<Anno[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]"); } catch { return []; }
  });

  useEffect(() => {
    supabase
      .from("announcements")
      .select("id,title,body,variant,audience")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setItems((data as Anno[]) ?? []));
  }, []);

  const audienceMatch = (a: string) => {
    if (a === "all") return true;
    if (a === "buyers") return !!user;
    if (a === "sellers") return isSeller;
    return false;
  };

  const visible = items.filter((i) => audienceMatch(i.audience) && !dismissed.includes(i.id));
  if (visible.length === 0) return null;

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const styles: Record<string, string> = {
    info: "bg-primary/10 text-primary border-primary/20",
    success: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-800 border-amber-500/20",
    danger: "bg-destructive/10 text-destructive border-destructive/20",
  };
  const icons: Record<string, any> = { info: Megaphone, success: CheckCircle2, warning: AlertTriangle, danger: AlertTriangle };

  return (
    <div className="space-y-1">
      {visible.map((a) => {
        const Icon = icons[a.variant] ?? Megaphone;
        return (
          <div key={a.id} className={`border-b ${styles[a.variant] ?? styles.info}`}>
            <div className="container flex items-center gap-3 py-2 text-sm">
              <Icon className="h-4 w-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold">{a.title}</span>
                {a.body && <span className="ml-2 opacity-90">{a.body}</span>}
              </div>
              <button onClick={() => dismiss(a.id)} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
