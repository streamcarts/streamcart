import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Copy, Gift, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import { inr } from "@/lib/format";

type Referral = { id: string; status: string; reward_amount: number; created_at: string };

export const ReferralPanel = () => {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [refs, setRefs] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) load(); }, [user]);

  const load = async () => {
    setLoading(true);
    const [c, r] = await Promise.all([
      supabase.from("referral_codes").select("code").eq("user_id", user!.id).maybeSingle(),
      supabase.from("referrals").select("id,status,reward_amount,created_at").eq("referrer_id", user!.id).order("created_at", { ascending: false }),
    ]);
    setCode(c.data?.code ?? null);
    setRefs((r.data as Referral[]) ?? []);
    setLoading(false);
  };

  const link = code ? `${window.location.origin}/?ref=${code}` : "";
  const total = refs.length;
  const converted = refs.filter((r) => r.status === "rewarded").length;
  const earned = refs.reduce((s, r) => s + Number(r.reward_amount || 0), 0);

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copied`); }
    catch { toast.error("Could not copy"); }
  };

  const share = async () => {
    const text = `Get premium subscriptions at 70% off on StreamCart. Sign up with my code ${code} for 5% off your first order!`;
    if ((navigator as any).share) {
      try { await (navigator as any).share({ title: "StreamCart", text, url: link }); return; }
      catch { /* fall through */ }
    }
    copy(`${text} ${link}`, "Invite message");
  };

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" /> Refer & earn
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Share your code — friends get <span className="text-primary font-semibold">5% off their first order</span> and you earn <span className="text-primary font-semibold">₹20</span> in wallet credit when they buy.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Invites sent" value={String(total)} />
            <Stat label="Conversions" value={String(converted)} />
            <Stat label="Earned" value={inr(earned)} />
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground font-medium">Your referral code</div>
            <div className="flex gap-2">
              <Input readOnly value={code ?? ""} className="font-mono font-semibold tracking-wider" />
              <Button variant="outline" onClick={() => code && copy(code, "Code")}><Copy className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground font-medium">Your referral link</div>
            <div className="flex gap-2">
              <Input readOnly value={link} className="text-xs" />
              <Button variant="outline" onClick={() => copy(link, "Link")}><Copy className="h-4 w-4" /></Button>
              <Button onClick={share}><Share2 className="h-4 w-4 mr-1.5" /> Share</Button>
            </div>
          </div>

          {refs.length > 0 && (
            <div className="border-t border-border pt-4">
              <div className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Recent referrals</div>
              <div className="space-y-1.5 max-h-40 overflow-auto">
                {refs.slice(0, 8).map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                    <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                    <Badge variant={r.status === "rewarded" ? "default" : "secondary"} className="capitalize">
                      {r.status === "rewarded" ? `+${inr(Number(r.reward_amount))}` : r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
    <div className="text-lg font-bold">{value}</div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
  </div>
);
