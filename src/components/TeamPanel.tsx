import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, ShieldCheck, Loader2, Activity } from "lucide-react";
import { toast } from "sonner";

type TeamRole = "super_admin" | "admin_staff" | "support";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Super Admin (legacy)",
  admin_staff: "Admin",
  support: "Support",
};

const ROLE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  super_admin: "default",
  admin: "default",
  admin_staff: "secondary",
  support: "outline",
};

export const TeamPanel = () => {
  const { user, roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin" as any) || roles.includes("admin");
  const [members, setMembers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("support");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [m, l] = await Promise.all([
      (supabase as any).rpc("list_team_members"),
      supabase.from("admin_activity_log" as any).select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setMembers(m.data ?? []);
    setLogs(l.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onAdd = async () => {
    if (!email.trim()) return toast.error("Email required");
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("add_team_member", { _email: email.trim(), _role: role });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data?.ok) return toast.error(data?.error || "Failed");
    toast.success("Team member added");
    setOpen(false); setEmail(""); setRole("support");
    load();
  };

  const onRemove = async (uid: string, r: string) => {
    const { error } = await (supabase as any).rpc("remove_team_role", { _user_id: uid, _role: r });
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  };

  if (!isSuperAdmin) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
        Only super admins can manage the team.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Team members</h3>
            <p className="text-xs text-muted-foreground">Manage admin & support roles</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add member</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add team member</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" />
                  <p className="text-xs text-muted-foreground mt-1">User must already have a StreamCart account.</p>
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={role} onValueChange={(v: any) => setRole(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super_admin">Super Admin — full access</SelectItem>
                      <SelectItem value="admin_staff">Admin — payments, orders, users</SelectItem>
                      <SelectItem value="support">Support — chats & complaints</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={onAdd} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : members.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No team members yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((m) => (
              <div key={`${m.user_id}-${m.role}`} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{m.display_name || m.email || m.user_id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={ROLE_VARIANT[m.role] || "outline"}>{ROLE_LABEL[m.role] || m.role}</Badge>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" disabled={m.user_id === user?.id}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove {ROLE_LABEL[m.role]}?</AlertDialogTitle>
                        <AlertDialogDescription>This user will lose this role immediately.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onRemove(m.user_id, m.role)}>Remove</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold flex items-center gap-2 mb-3"><Activity className="h-4 w-4" /> Recent activity</h3>
        {logs.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">No activity yet.</div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto text-sm">
            {logs.map((l) => (
              <div key={l.id} className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
                <div className="min-w-0">
                  <div className="font-mono text-xs">{l.action}</div>
                  {l.target_type && (
                    <div className="text-xs text-muted-foreground truncate">
                      {l.target_type}: {l.target_id?.slice(0, 12)}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(l.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
