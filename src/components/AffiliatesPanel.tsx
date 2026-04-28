import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import { Loader2, Plus, Search, UserPlus } from "lucide-react";

type Aff = {
  id: string;
  user_id: string;
  slug: string;
  commission_percent: number;
  status: string;
  total_clicks: number;
  total_conversions: number;
  total_earned: number;
  created_at: string;
};

type Profile = { id: string; email: string | null; display_name: string | null };

export const AffiliatesPanel = () => {
  const [affs, setAffs] = useState<Aff[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emailQuery, setEmailQuery] = useState("");
  const [matches, setMatches] = useState<Profile[]>([]);
  const [picked, setPicked] = useState<Profile | null>(null);
  const [slug, setSlug] = useState("");
  const [commission, setCommission] = useState("20");
  const [status, setStatus] = useState<"approved" | "pending" | "suspended">("approved");

  const load = async () => {
    setLoading(true);
    const { data: a } = await supabase
      .from("affiliates")
      .select("*")
      .order("created_at", { ascending: false });
    const list = (a as Aff[]) ?? [];
    setAffs(list);
    if (list.length > 0) {
      const ids = list.map((x) => x.user_id);
      const { data: ps } = await supabase.from("profiles").select("id,email,display_name").in("id", ids);
      const map: Record<string, Profile> = {};
      (ps ?? []).forEach((p: any) => { map[p.id] = p; });
      setProfilesMap(map);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const searchUser = async (q: string) => {
    setEmailQuery(q);
    if (q.length < 3) { setMatches([]); return; }
    const { data } = await supabase
      .from("profiles")
      .select("id,email,display_name")
      .or(`email.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(8);
    setMatches((data as Profile[]) ?? []);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked) return toast.error("Pick a user");
    const c = parseFloat(commission);
    if (isNaN(c) || c < 0 || c > 50) return toast.error("Commission must be 0–50%");
    const slugClean = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60);
    if (slugClean.length < 3) return toast.error("Slug must be 3+ chars");
    setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_set_affiliate", {
        _user_id: picked.id,
        _slug: slugClean,
        _commission: c,
        _status: status,
      });
      if (error) throw error;
      toast.success(`Affiliate ${status}`);
      setOpen(false); setPicked(null); setSlug(""); setCommission("20"); setEmailQuery(""); setMatches([]);
      load();
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  const updateOne = async (a: Aff, patch: { commission_percent?: number; status?: string; slug?: string }) => {
    const c = patch.commission_percent ?? a.commission_percent;
    const st = (patch.status ?? a.status) as "approved" | "pending" | "suspended";
    const sl = patch.slug ?? a.slug;
    const { error } = await supabase.rpc("admin_set_affiliate", {
      _user_id: a.user_id, _slug: sl, _commission: c, _status: st,
    });
    if (error) toast.error(error.message);
    else { toast.success("Updated"); load(); }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-semibold">Affiliate program</h2>
          <p className="text-xs text-muted-foreground">Promote users to affiliates and set custom commissions (0–50%).</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><UserPlus className="h-4 w-4 mr-1.5" /> Add affiliate</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Promote user to affiliate</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Search user (email or name)</Label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" value={emailQuery} onChange={(e) => searchUser(e.target.value)} placeholder="user@example.com" />
                </div>
                {matches.length > 0 && !picked && (
                  <div className="border border-border rounded-lg max-h-40 overflow-auto">
                    {matches.map((m) => (
                      <button key={m.id} type="button" onClick={() => { setPicked(m); setSlug((m.display_name || m.email || "").split("@")[0].toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,16)); setMatches([]); }} className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b border-border last:border-0">
                        <div className="font-medium">{m.display_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{m.email}</div>
                      </button>
                    ))}
                  </div>
                )}
                {picked && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium">{picked.display_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{picked.email}</div>
                    </div>
                    <Button size="sm" variant="ghost" type="button" onClick={() => setPicked(null)}>Change</Button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="slug">Affiliate slug</Label>
                  <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ravi" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="comm">Commission (%)</Label>
                  <Input id="comm" type="number" min="0" max="50" step="0.5" value={commission} onChange={(e) => setCommission(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : affs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No affiliates yet. Click "Add affiliate" to create one.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Slug</th>
                <th className="py-2 pr-3">Commission</th>
                <th className="py-2 pr-3">Clicks</th>
                <th className="py-2 pr-3">Conv.</th>
                <th className="py-2 pr-3">Earned</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {affs.map((a) => {
                const p = profilesMap[a.user_id];
                return (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{p?.display_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[180px]">{p?.email}</div>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{a.slug}</td>
                    <td className="py-2 pr-3">
                      <Input
                        type="number" min="0" max="50" step="0.5" defaultValue={a.commission_percent}
                        className="h-7 w-20"
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v !== Number(a.commission_percent)) updateOne(a, { commission_percent: v });
                        }}
                      />
                    </td>
                    <td className="py-2 pr-3">{a.total_clicks}</td>
                    <td className="py-2 pr-3">{a.total_conversions}</td>
                    <td className="py-2 pr-3 font-semibold">{inr(a.total_earned)}</td>
                    <td className="py-2 pr-3">
                      <Select value={a.status} onValueChange={(v) => updateOne(a, { status: v })}>
                        <SelectTrigger className="h-7 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
