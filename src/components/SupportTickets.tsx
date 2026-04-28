import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LifeBuoy, Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";

type Ticket = {
  id: string;
  subject: string;
  category: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  related_order_id: string | null;
};

type Msg = { id: string; body: string; is_admin_reply: boolean; created_at: string; author_id: string };

export const SupportTickets = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [description, setDescription] = useState("");
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setTickets((data as Ticket[]) ?? []);
  };

  useEffect(() => { load(); }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (subject.trim().length < 4) return toast.error("Subject too short");
    if (description.trim().length < 10) return toast.error("Please describe the issue (10+ chars)");
    setBusy(true);
    try {
      const { data: t, error } = await supabase
        .from("support_tickets")
        .insert({ user_id: user.id, subject: subject.trim(), category })
        .select()
        .single();
      if (error) throw error;
      const { error: mErr } = await supabase
        .from("ticket_messages")
        .insert({ ticket_id: t.id, author_id: user.id, body: description.trim(), is_admin_reply: false });
      if (mErr) throw mErr;
      toast.success("Ticket submitted! We'll respond shortly.");
      setSubject(""); setDescription(""); setCategory("general");
      setOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Could not submit ticket");
    } finally { setBusy(false); }
  };

  const openTicket = async (t: Ticket) => {
    setActiveTicket(t);
    const { data } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", t.id)
      .order("created_at", { ascending: true });
    setMessages((data as Msg[]) ?? []);
  };

  const sendReply = async () => {
    if (!user || !activeTicket || reply.trim().length < 1) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("ticket_messages")
        .insert({ ticket_id: activeTicket.id, author_id: user.id, body: reply.trim(), is_admin_reply: false })
        .select()
        .single();
      if (error) throw error;
      setMessages((m) => [...m, data as Msg]);
      setReply("");
    } catch (err: any) {
      toast.error(err.message);
    } finally { setBusy(false); }
  };

  const statusBadge = (s: string) => {
    const map: any = { open: "secondary", in_progress: "default", resolved: "outline", closed: "outline" };
    return <Badge variant={map[s] ?? "secondary"} className="capitalize">{s.replace("_", " ")}</Badge>;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="font-semibold flex items-center gap-2">
          <LifeBuoy className="h-4 w-4 text-primary" /> Support tickets
        </h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><MessageCircle className="h-4 w-4 mr-1.5" /> Raise ticket</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Raise a support ticket</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cat">Issue type</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="cat"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General question</SelectItem>
                    <SelectItem value="order">Order / delivery issue</SelectItem>
                    <SelectItem value="payment">Payment / wallet</SelectItem>
                    <SelectItem value="credentials">Credentials not working</SelectItem>
                    <SelectItem value="refund">Refund request</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subj">Subject</Label>
                <Input id="subj" value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="desc">Description</Label>
                <Textarea id="desc" value={description} maxLength={2000} rows={5} onChange={(e) => setDescription(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit ticket
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {tickets === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No tickets yet. Need help? Raise one above.</p>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <button key={t.id} onClick={() => openTicket(t)} className="w-full text-left flex items-center justify-between gap-3 py-3 px-3 rounded-lg border border-border hover:bg-accent/40 transition-colors">
              <div className="min-w-0">
                <div className="font-medium truncate">{t.subject}</div>
                <div className="text-xs text-muted-foreground">{t.category ?? "general"} • {new Date(t.created_at).toLocaleDateString()}</div>
              </div>
              {statusBadge(t.status)}
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!activeTicket} onOpenChange={(v) => !v && setActiveTicket(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3">
              <span className="truncate">{activeTicket?.subject}</span>
              {activeTicket && statusBadge(activeTicket.status)}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto space-y-3 py-2">
            {messages.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No messages.</p>}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.is_admin_reply ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[80%] rounded-lg p-3 text-sm ${m.is_admin_reply ? "bg-muted" : "bg-primary text-primary-foreground"}`}>
                  <div className="text-[10px] opacity-70 mb-1">{m.is_admin_reply ? "Support" : "You"} • {new Date(m.created_at).toLocaleString()}</div>
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                </div>
              </div>
            ))}
          </div>
          {activeTicket && activeTicket.status !== "closed" && (
            <DialogFooter className="flex gap-2 sm:gap-2">
              <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply…" maxLength={1000} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendReply(); } }} />
              <Button onClick={sendReply} disabled={busy || reply.trim().length === 0}>
                <Send className="h-4 w-4" />
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
