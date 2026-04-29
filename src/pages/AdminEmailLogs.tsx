import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, RefreshCw } from "lucide-react";

type EmailLog = {
  id: string;
  notification_id: string | null;
  recipient: string;
  subject: string;
  type: string | null;
  status: "sent" | "failed" | "retry";
  attempt: number;
  provider_id: string | null;
  error: string | null;
  created_at: string;
};

const STATUS_VARIANT: Record<EmailLog["status"], "default" | "destructive" | "secondary"> = {
  sent: "default",
  failed: "destructive",
  retry: "secondary",
};

export default function AdminEmailLogs() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | EmailLog["status"]>("all");

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("email_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data, error } = await q;
    if (!error && data) setLogs(data as EmailLog[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  const filtered = logs.filter((l) => {
    if (!filter.trim()) return true;
    const f = filter.toLowerCase();
    return (
      l.recipient.toLowerCase().includes(f) ||
      l.subject.toLowerCase().includes(f) ||
      (l.type ?? "").toLowerCase().includes(f)
    );
  });

  const counts = {
    sent: logs.filter((l) => l.status === "sent").length,
    retry: logs.filter((l) => l.status === "retry").length,
    failed: logs.filter((l) => l.status === "failed").length,
  };

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
        </Button>
        <h1 className="text-2xl font-bold">Email Logs</h1>
        <Button variant="outline" size="sm" className="ml-auto" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Sent</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-primary">{counts.sent}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Retried</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{counts.retry}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Failed</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-destructive">{counts.failed}</CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Search by email, subject, type…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex gap-1">
          {(["all", "sent", "retry", "failed"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Status</th>
                <th className="p-3">Type</th>
                <th className="p-3">Recipient</th>
                <th className="p-3">Subject</th>
                <th className="p-3">Attempt</th>
                <th className="p-3">Error</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">
                  {loading ? "Loading…" : "No email logs yet."}
                </td></tr>
              )}
              {filtered.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="p-3 whitespace-nowrap text-muted-foreground">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td className="p-3"><Badge variant={STATUS_VARIANT[l.status]}>{l.status}</Badge></td>
                  <td className="p-3">{l.type ?? "—"}</td>
                  <td className="p-3">{l.recipient}</td>
                  <td className="p-3 max-w-[260px] truncate" title={l.subject}>{l.subject}</td>
                  <td className="p-3">{l.attempt}</td>
                  <td className="p-3 max-w-[280px] truncate text-destructive" title={l.error ?? ""}>
                    {l.error ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
