import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Loader2, Send, ShieldAlert, KeyRound, CheckCircle2, AlertTriangle, Clock, MessageSquareText, Copy, Eye, EyeOff, Flag, ChevronLeft, ImagePlus, X,
} from "lucide-react";
import { toast } from "sonner";
import { inr } from "@/lib/format";

type Order = {
  id: string; buyer_id: string; seller_id: string; service_name: string;
  total_paid: number; status: string; delivery_mode: string; chat_id: string | null;
  credentials_email: string | null; credentials_password: string | null;
  credentials_sent_at: string | null; received_at: string | null;
  created_at: string;
};
type Chat = {
  id: string; order_id: string; buyer_id: string; seller_id: string; status: string;
  response_due_at: string; delivered_at: string | null; auto_complete_at: string | null;
};
type Msg = {
  id: string; chat_id: string; sender_id: string | null;
  kind: "text" | "credentials" | "system" | "image";
  body: string | null; cred_email: string | null; cred_password: string | null; cred_notes: string | null;
  is_flagged: boolean; flag_reason: string | null; is_blocked: boolean;
  chat_image_path: string | null;
  created_at: string;
};

const OrderChat = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [revealCred, setRevealCred] = useState<Record<string, boolean>>({});
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [otherOnline, setOtherOnline] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);

  const isSeller = user && order && order.seller_id === user.id;
  const isBuyer = user && order && order.buyer_id === user.id;

  useEffect(() => { document.title = "Order chat — StreamCart"; }, []);

  const load = async () => {
    if (!orderId || !user) return;
    setLoading(true);
    const { data: o, error: oerr } = await supabase
      .from("orders").select("*").eq("id", orderId).maybeSingle();
    if (oerr || !o) { toast.error("Order not found"); navigate("/buyer"); return; }
    setOrder(o as Order);

    let chatId = (o as Order).chat_id;
    if (!chatId) {
      const { data: cid, error: cerr } = await supabase.rpc("ensure_order_chat", { _order_id: orderId });
      if (cerr) { toast.error(cerr.message); setLoading(false); return; }
      chatId = cid as string;
    }
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from("order_chats").select("*").eq("id", chatId!).maybeSingle(),
      supabase.from("chat_messages").select("*").eq("chat_id", chatId!).order("created_at", { ascending: true }),
    ]);
    setChat(c as Chat);
    setMsgs((m as Msg[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orderId, user?.id]);

  // Realtime
  useEffect(() => {
    if (!chat?.id) return;
    const channel = supabase
      .channel(`chat-${chat.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `chat_id=eq.${chat.id}` },
        (payload) => {
          setMsgs((cur) => [...cur, payload.new as Msg]);
          // Mark read if the new message is from the other party and we're viewing
          const m = payload.new as Msg;
          if (user && m.sender_id && m.sender_id !== user.id) {
            supabase.rpc("mark_chat_read", { _chat_id: chat.id });
          }
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "order_chats", filter: `id=eq.${chat.id}` },
        (payload) => setChat(payload.new as Chat))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chat?.id, user?.id]);

  // Mark chat as read on open
  useEffect(() => {
    if (chat?.id && user?.id) {
      supabase.rpc("mark_chat_read", { _chat_id: chat.id });
    }
  }, [chat?.id, user?.id]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);

  // Poll other party's online status every 30s
  useEffect(() => {
    if (!order || !user) return;
    const otherId = user.id === order.buyer_id ? order.seller_id : order.buyer_id;
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase.rpc("is_user_online", { _user_id: otherId });
      if (!cancelled) setOtherOnline(!!data);
    };
    check();
    const i = setInterval(check, 30_000);
    return () => { cancelled = true; clearInterval(i); };
  }, [order?.buyer_id, order?.seller_id, user?.id]);

  const send = async () => {
    if (!chat || !body.trim()) return;
    setSending(true);
    const { error } = await supabase.rpc("send_chat_message", { _chat_id: chat.id, _body: body.trim() });
    setSending(false);
    if (error) return toast.error(error.message);
    setBody("");
  };

  const onPickImage = (f: File | null) => {
    if (!f) { setImgFile(null); setImgPreview(null); return; }
    if (!f.type.startsWith("image/")) { toast.error("Only image files allowed"); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    setImgFile(f);
    setImgPreview(URL.createObjectURL(f));
  };

  const sendImage = async () => {
    if (!chat || !imgFile || !user) return;
    setUploading(true);
    try {
      const ext = imgFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${chat.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("chat-images").upload(path, imgFile, {
        contentType: imgFile.type, upsert: false,
      });
      if (upErr) throw upErr;

      const { data, error } = await supabase.functions.invoke("chat-image-ocr", {
        body: { chat_id: chat.id, image_path: path },
      });
      if (error) throw error;
      if ((data as any)?.blocked) {
        toast.error("Image blocked: contact info detected");
      } else {
        toast.success("Image sent");
      }
      setImgFile(null); setImgPreview(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const markReceived = async () => {
    if (!order) return;
    const { error } = await supabase.rpc("mark_order_received", { _order_id: order.id });
    if (error) return toast.error(error.message);
    toast.success("Order marked as received. Seller payment released.");
    load();
  };

  const copy = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    toast.success(`${label} copied`);
  };

  const responseTimer = useResponseTimer(chat);

  if (loading || !order || !chat) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container py-8 max-w-3xl space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-[400px] w-full" />
          <Skeleton className="h-12 w-full" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-6 max-w-3xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(isSeller ? "/seller" : "/buyer")} className="mb-3 -ml-2">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        {/* Header */}
        <Card className="p-4 mb-3">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/15">
                  <MessageSquareText className="h-3 w-3 mr-1" /> Chat delivery
                </Badge>
                <StatusBadge status={chat.status} />
              </div>
              <div className="font-semibold flex items-center gap-2">
                {order.service_name}
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full border ${otherOnline ? "bg-primary/10 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${otherOnline ? "bg-primary animate-pulse" : "bg-muted-foreground/50"}`} />
                  {isSeller ? "Buyer" : "Seller"} {otherOnline ? "online" : "offline"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()} • {inr(order.total_paid)}</div>
            </div>
            {chat.status === "pending_delivery" && (
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Seller must respond in</div>
                <div className={`font-bold ${responseTimer.expired ? "text-destructive" : "text-primary"} flex items-center gap-1 justify-end`}>
                  <Clock className="h-4 w-4" /> {responseTimer.label}
                </div>
              </div>
            )}
            {chat.status === "delivered" && chat.auto_complete_at && (
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Auto-complete in</div>
                <div className="font-semibold text-muted-foreground flex items-center gap-1 justify-end">
                  <Clock className="h-4 w-4" /> {timeUntil(chat.auto_complete_at)}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Trust banner */}
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 mb-3 text-xs flex gap-2 items-start">
          <ShieldAlert className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div>
            <strong>No external contact.</strong> Phone, WhatsApp, Telegram, email or external links are auto-blocked. Sellers caught sharing contact info are flagged and may be banned.
          </div>
        </div>

        {/* Messages */}
        <Card className="p-0 overflow-hidden flex flex-col">
          <div ref={scrollRef} className="h-[420px] overflow-y-auto p-4 space-y-3 bg-muted/20">
            {msgs.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">No messages yet.</p>}
            {msgs.map((m) => (
              <MessageBubble
                key={m.id}
                m={m}
                isMine={!!user && m.sender_id === user.id}
                revealed={!!revealCred[m.id]}
                toggleReveal={() => setRevealCred((r) => ({ ...r, [m.id]: !r[m.id] }))}
                onCopy={copy}
              />
            ))}
          </div>

          {/* Composer / actions */}
          <div className="border-t border-border bg-card p-3 space-y-2">
            {chat.status === "completed" ? (
              <div className="text-center text-sm text-muted-foreground py-2 flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Order completed
              </div>
            ) : (
              <>
                {imgPreview && (
                  <div className="relative inline-block rounded-lg border border-border overflow-hidden">
                    <img src={imgPreview} alt="preview" className="max-h-32 object-cover" />
                    <button
                      type="button"
                      onClick={() => onPickImage(null)}
                      className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 hover:bg-background"
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <Button size="sm" className="absolute bottom-1 right-1" onClick={sendImage} disabled={uploading}>
                      {uploading ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Scanning…</> : "Send image"}
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Write a message…  (Enter to send, Shift+Enter for newline)"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={2}
                    maxLength={2000}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                    }}
                    className="resize-none"
                  />
                  <div className="flex flex-col gap-2">
                    <Button onClick={send} disabled={sending || !body.trim()} size="icon">
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                    <label>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                      />
                      <Button type="button" size="icon" variant="outline" asChild title="Attach image (auto-scanned for contact info)">
                        <span><ImagePlus className="h-4 w-4" /></span>
                      </Button>
                    </label>
                    {isSeller && <SendCredentialsDialog chatId={chat.id} onDone={load} />}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">Images are scanned for phone/email/links before sending</p>
                  <div className="flex items-center gap-2">
                    {isBuyer && chat.status === "delivered" && (
                      <Button size="sm" onClick={markReceived}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Mark as Received
                      </Button>
                    )}
                    {isBuyer && (
                      <Button size="sm" variant="outline" onClick={() => setComplaintOpen(true)}>
                        <Flag className="h-3.5 w-3.5 mr-1.5" /> Complaint
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>

        <ComplaintDialog
          open={complaintOpen}
          onOpenChange={setComplaintOpen}
          orderId={order.id}
          onFiled={() => { setComplaintOpen(false); load(); }}
        />
      </main>
      <Footer />
    </div>
  );
};

// ============== Sub-components ==============

const MessageBubble = ({
  m, isMine, revealed, toggleReveal, onCopy,
}: {
  m: Msg; isMine: boolean; revealed: boolean;
  toggleReveal: () => void; onCopy: (s: string, label: string) => void;
}) => {
  if (m.kind === "system") {
    return (
      <div className="text-center">
        <span className="inline-block text-[11px] text-muted-foreground bg-background border border-border rounded-full px-3 py-1">
          {m.body}
        </span>
      </div>
    );
  }
  if (m.kind === "credentials") {
    return (
      <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
        <div className="max-w-[85%] rounded-2xl border-2 border-primary bg-primary/5 p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wide">Credentials delivered</span>
          </div>
          <div className="space-y-2 font-mono text-sm">
            <CredRow label="Email / Username" value={m.cred_email ?? ""} revealed={revealed} onCopy={() => onCopy(m.cred_email!, "Email")} />
            <CredRow label="Password" value={m.cred_password ?? ""} revealed={revealed} onCopy={() => onCopy(m.cred_password!, "Password")} />
            {m.cred_notes && (
              <div className="text-xs text-muted-foreground font-sans border-t border-border pt-2 mt-2 whitespace-pre-line">
                {m.cred_notes}
              </div>
            )}
          </div>
          <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={toggleReveal}>
            {revealed ? <><EyeOff className="h-3.5 w-3.5 mr-1.5" />Hide</> : <><Eye className="h-3.5 w-3.5 mr-1.5" />Reveal</>}
          </Button>
          <div className="text-[10px] text-muted-foreground text-right mt-1">{new Date(m.created_at).toLocaleTimeString()}</div>
        </div>
      </div>
    );
  }
  if (m.is_blocked) {
    return (
      <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
        <div className="max-w-[85%] rounded-2xl bg-destructive/10 border border-destructive/40 p-3">
          <div className="flex items-center gap-2 text-destructive text-xs font-semibold mb-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Blocked ({m.flag_reason?.replace(/_/g, " ")})
          </div>
          <div className="text-sm text-foreground">{m.body}</div>
        </div>
      </div>
    );
  }
  if (m.kind === "image" && m.chat_image_path) {
    return (
      <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
        <div className={`max-w-[75%] rounded-2xl overflow-hidden ${isMine ? "bg-primary/10 border border-primary/30" : "bg-card border border-border"}`}>
          <ChatImage path={m.chat_image_path} />
          <div className="px-2 py-1 text-[10px] text-muted-foreground text-right">
            {new Date(m.created_at).toLocaleTimeString()}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
        isMine ? "bg-primary text-primary-foreground" : "bg-card border border-border"
      }`}>
        <div className="text-sm whitespace-pre-line">{m.body}</div>
        <div className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {new Date(m.created_at).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

const ChatImage = ({ path }: { path: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.storage.from("chat-images").createSignedUrl(path, 600).then(({ data }) => {
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [path]);
  if (!url) return <div className="w-64 h-40 bg-muted animate-pulse" />;
  return <img src={url} alt="attachment" className="max-w-full max-h-72 object-contain bg-black/5" />;
};

const CredRow = ({ label, value, revealed, onCopy }: { label: string; value: string; revealed: boolean; onCopy: () => void }) => {
  const masked = value.length > 2 ? value[0] + "•".repeat(Math.max(4, value.length - 2)) + value[value.length - 1] : "••";
  return (
    <div className="flex items-center justify-between gap-2 bg-background/60 rounded px-2 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-muted-foreground font-sans uppercase tracking-wide">{label}</div>
        <div className="truncate">{revealed ? value : masked}</div>
      </div>
      <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!revealed} onClick={onCopy}>
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    pending_delivery: { label: "Awaiting credentials", cls: "bg-warning/15 text-warning border-warning/30" },
    delivered: { label: "Delivered", cls: "bg-primary/15 text-primary border-primary/30" },
    completed: { label: "Completed", cls: "bg-primary text-primary-foreground" },
    disputed: { label: "Disputed", cls: "bg-destructive/15 text-destructive border-destructive/40" },
    cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
  };
  const v = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <Badge className={v.cls} variant="outline">{v.label}</Badge>;
};

const SendCredentialsDialog = ({ chatId, onDone }: { chatId: string; onDone: () => void }) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password.trim()) return toast.error("Email and password required");
    setBusy(true);
    const { error } = await supabase.rpc("send_chat_credentials", {
      _chat_id: chatId, _email: email.trim(), _password: password.trim(), _notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Credentials sent securely");
    setOpen(false); setEmail(""); setPassword(""); setNotes("");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" title="Send credentials">
          <KeyRound className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> Send credentials</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Email / Username</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} maxLength={200} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500}
              placeholder="Profile name, PIN, etc. — no contact info." />
          </div>
          <div className="rounded-md bg-warning/10 border border-warning/30 p-2 text-xs text-warning flex gap-2 items-start">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Notes me phone, email ya social handle mat likhna — auto-detect ho jayega.</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Send credentials
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============== timer hooks ==============

const useResponseTimer = (chat: Chat | null) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return useMemo(() => {
    if (!chat) return { label: "—", expired: false };
    return computeRemaining(chat.response_due_at);
    // eslint-disable-next-line
  }, [chat?.response_due_at, tick]);
};

const computeRemaining = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { label: "Overdue", expired: true };
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { label: `${m}m ${s.toString().padStart(2, "0")}s`, expired: false };
};

const timeUntil = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "soon";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const ComplaintDialog = ({
  open, onOpenChange, orderId, onFiled,
}: { open: boolean; onOpenChange: (v: boolean) => void; orderId: string; onFiled: () => void }) => {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (reason.trim().length < 3) return toast.error("Please choose or enter a reason");
    setBusy(true);
    const { error } = await supabase.rpc("file_complaint", {
      _order_id: orderId, _reason: reason.trim(), _details: details.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Complaint filed. Seller has been restricted pending admin review.");
    setReason(""); setDetails("");
    onFiled();
  };

  const presets = [
    "Credentials not working",
    "Account stopped working before plan expiry",
    "Wrong product / plan delivered",
    "Seller not responding",
    "Other",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Flag className="h-4 w-4 text-destructive" /> File a complaint</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-warning/10 border border-warning/30 p-2 text-xs flex gap-2 items-start">
            <ShieldAlert className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
            <span>Filing a complaint will <strong>immediately restrict the seller</strong> (no new listings, no withdrawals) until admin reviews. Please file only genuine issues.</span>
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setReason(p)}
                  className={`text-xs px-2.5 py-1 rounded-full border ${reason === p ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}
                >{p}</button>
              ))}
            </div>
            {reason === "Other" && (
              <Input value={reason === "Other" ? "" : reason} onChange={(e) => setReason(e.target.value)} placeholder="Describe in a few words" maxLength={120} />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Details (optional)</Label>
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={500}
              placeholder="Explain what happened. Do not share personal contact info." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}File complaint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderChat;
