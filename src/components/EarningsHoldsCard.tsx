import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import { Clock } from "lucide-react";

type Hold = {
  id: string;
  amount: number;
  source: string;
  status: string;
  release_at: string;
  created_at: string;
};

interface Props {
  userId: string;
  pendingBalance: number;
}

export const EarningsHoldsCard = ({ userId, pendingBalance }: Props) => {
  const [holds, setHolds] = useState<Hold[] | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("earnings_holds")
      .select("id,amount,source,status,release_at,created_at")
      .eq("user_id", userId)
      .eq("status", "holding")
      .order("release_at", { ascending: true })
      .limit(20)
      .then(({ data }) => setHolds((data as Hold[]) ?? []));
  }, [userId]);

  const fmtCountdown = (iso: string) => {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return "releasing soon";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    return `${h}h ${m}m`;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" /> Pending earnings (3-day hold)
          </h2>
          <p className="text-xs text-muted-foreground">
            Earnings auto-release to your withdrawable balance after 3 days.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">On hold</div>
          <div className="text-xl font-bold">{inr(pendingBalance)}</div>
        </div>
      </div>
      {holds === null ? (
        <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : holds.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No earnings on hold.</p>
      ) : (
        <div className="space-y-2">
          {holds.map((h) => (
            <div key={h.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">{h.source}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(h.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">releases in {fmtCountdown(h.release_at)}</span>
                <span className="font-semibold">{inr(h.amount)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
