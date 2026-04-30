import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Upload, Image as ImageIcon, Save, X } from "lucide-react";
import { useCategories } from "@/lib/categories";

type Platform = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  category: string;
  sort_order: number;
  is_active: boolean;
  plan_tiers?: string[];
};
type Duration = { id: string; label: string; days: number; sort_order: number; is_active: boolean };
type Pricing = { id: string; platform_id: string; duration_id: string; min_price: number };

const DEFAULT_PLAN_TIERS = ["Mobile", "Basic", "Standard", "Premium"];

export default function PlatformsPanel() {
  const [loading, setLoading] = useState(true);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [durations, setDurations] = useState<Duration[]>([]);
  const [pricing, setPricing] = useState<Pricing[]>([]);

  const [editPlatform, setEditPlatform] = useState<Platform | null>(null);
  const [editDuration, setEditDuration] = useState<Duration | null>(null);

  const load = async () => {
    setLoading(true);
    const [pRes, dRes, prRes] = await Promise.all([
      supabase.from("platforms" as any).select("*").order("sort_order"),
      supabase.from("platform_durations" as any).select("*").order("sort_order"),
      supabase.from("platform_pricing" as any).select("*"),
    ]);
    if (pRes.data) setPlatforms(pRes.data as any);
    if (dRes.data) setDurations(dRes.data as any);
    if (prRes.data) setPricing(prRes.data as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const minFor = (pid: string, did: string) =>
    pricing.find((r) => r.platform_id === pid && r.duration_id === did)?.min_price ?? null;

  const setMin = async (pid: string, did: string, value: number) => {
    if (isNaN(value) || value < 0) return;
    const existing = pricing.find((r) => r.platform_id === pid && r.duration_id === did);
    if (existing) {
      const { error } = await (supabase.from("platform_pricing" as any) as any)
        .update({ min_price: value }).eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await (supabase.from("platform_pricing" as any) as any)
        .insert({ platform_id: pid, duration_id: did, min_price: value });
      if (error) return toast.error(error.message);
    }
    toast.success("Saved");
    load();
  };

  const removeMin = async (pid: string, did: string) => {
    const existing = pricing.find((r) => r.platform_id === pid && r.duration_id === did);
    if (!existing) return;
    const { error } = await (supabase.from("platform_pricing" as any) as any).delete().eq("id", existing.id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  };

  if (loading) {
    return (
      <Card className="p-8 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Platforms */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Platforms</h3>
            <p className="text-xs text-muted-foreground">Sirf yahan add ki gayi platforms sellers ko dikhti hain.</p>
          </div>
          <Button size="sm" onClick={() => setEditPlatform({ id: "", name: "", slug: "", logo_url: null, category: "OTT", sort_order: 100, is_active: true })}>
            <Plus className="h-4 w-4 mr-1" /> Add platform
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {platforms.map((p) => (
            <div key={p.id} className="border rounded-lg p-3 flex items-center gap-3">
              {p.logo_url ? (
                <img src={p.logo_url} alt={p.name} className="h-10 w-10 object-contain rounded bg-muted/40" />
              ) : (
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  {p.category}
                  {!p.is_active && <Badge variant="outline" className="h-4 text-[10px]">hidden</Badge>}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setEditPlatform(p)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {platforms.length === 0 && (
            <div className="col-span-full text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
              No platforms yet. Add one above.
            </div>
          )}
        </div>
      </Card>

      {/* Durations */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Allowed Durations</h3>
            <p className="text-xs text-muted-foreground">Sellers can only choose from these durations.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditDuration({ id: "", label: "", days: 30, sort_order: 100, is_active: true })}>
            <Plus className="h-4 w-4 mr-1" /> Add duration
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {durations.map((d) => (
            <button
              key={d.id}
              onClick={() => setEditDuration(d)}
              className="rounded-full border px-3 py-1 text-sm hover:border-primary hover:bg-primary/5 transition flex items-center gap-2"
            >
              {d.label}
              <span className="text-xs text-muted-foreground">{d.days}d</span>
              {!d.is_active && <Badge variant="outline" className="h-4 text-[10px]">off</Badge>}
            </button>
          ))}
        </div>
      </Card>

      {/* Pricing matrix */}
      <Card className="p-5 space-y-4">
        <div>
          <h3 className="font-semibold">Minimum Pricing Matrix</h3>
          <p className="text-xs text-muted-foreground">
            Sellers ka price is se kam nahi ho sakta. Khali chhodne ka matlab "is duration ke liye platform allowed nahi".
          </p>
        </div>
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2 font-medium text-xs text-muted-foreground sticky left-0 bg-background">Platform</th>
                {durations.map((d) => (
                  <th key={d.id} className="text-left py-2 px-2 font-medium text-xs text-muted-foreground whitespace-nowrap">{d.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {platforms.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2 px-2 sticky left-0 bg-background">
                    <div className="flex items-center gap-2">
                      {p.logo_url && <img src={p.logo_url} alt="" className="h-5 w-5 object-contain rounded" />}
                      <span className="font-medium text-sm whitespace-nowrap">{p.name}</span>
                    </div>
                  </td>
                  {durations.map((d) => (
                    <td key={d.id} className="py-2 px-2">
                      <PriceCell
                        value={minFor(p.id, d.id)}
                        onSave={(v) => setMin(p.id, d.id, v)}
                        onClear={() => removeMin(p.id, d.id)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editPlatform && (
        <PlatformDialog
          platform={editPlatform}
          onClose={() => setEditPlatform(null)}
          onSaved={() => { setEditPlatform(null); load(); }}
        />
      )}
      {editDuration && (
        <DurationDialog
          duration={editDuration}
          onClose={() => setEditDuration(null)}
          onSaved={() => { setEditDuration(null); load(); }}
        />
      )}
    </div>
  );
}

function PriceCell({ value, onSave, onClear }: { value: number | null; onSave: (v: number) => void; onClear: () => void }) {
  const [val, setVal] = useState(value == null ? "" : String(value));
  useEffect(() => { setVal(value == null ? "" : String(value)); }, [value]);
  return (
    <div className="flex items-center gap-1">
      <Input
        type="number" min="0" step="1"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          if (val.trim() === "") {
            if (value != null) onClear();
          } else {
            const n = parseFloat(val);
            if (!isNaN(n) && n !== value) onSave(n);
          }
        }}
        placeholder="—"
        className="h-8 w-20 text-sm"
      />
    </div>
  );
}

function PlatformDialog({ platform, onClose, onSaved }: { platform: Platform; onClose: () => void; onSaved: () => void }) {
  const isNew = !platform.id;
  const [form, setForm] = useState<Platform>(platform);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please select an image");
    if (file.size > 2 * 1024 * 1024) return toast.error("Max 2 MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${form.slug || slugify(form.name) || crypto.randomUUID()}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("platform-logos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("platform-logos").getPublicUrl(path);
      setForm({ ...form, logo_url: data.publicUrl });
      toast.success("Logo uploaded");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    const slug = form.slug.trim() || slugify(form.name);
    setBusy(true);
    try {
      if (isNew) {
        const { error } = await (supabase.from("platforms" as any) as any).insert({
          name: form.name.trim(), slug, logo_url: form.logo_url, category: form.category,
          sort_order: form.sort_order, is_active: form.is_active,
        });
        if (error) throw error;
        toast.success("Platform added");
      } else {
        const { error } = await (supabase.from("platforms" as any) as any).update({
          name: form.name.trim(), slug, logo_url: form.logo_url, category: form.category,
          sort_order: form.sort_order, is_active: form.is_active,
        }).eq("id", form.id);
        if (error) throw error;
        toast.success("Saved");
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete platform "${form.name}"? This will also remove its pricing.`)) return;
    setBusy(true);
    const { error } = await (supabase.from("platforms" as any) as any).delete().eq("id", form.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "Add platform" : "Edit platform"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {form.logo_url ? (
              <img src={form.logo_url} alt="" className="h-16 w-16 object-contain rounded border bg-muted/30" />
            ) : (
              <div className="h-16 w-16 rounded border bg-muted flex items-center justify-center">
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                Upload logo
              </Button>
              <input
                ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
              />
              <span className="text-xs text-muted-foreground">PNG/JPG up to 2 MB</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sort order</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Active</div>
              <div className="text-xs text-muted-foreground">Inactive platforms are hidden from the seller form.</div>
            </div>
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {!isNew && (
            <Button variant="outline" className="text-destructive" onClick={remove} disabled={busy}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DurationDialog({ duration, onClose, onSaved }: { duration: Duration; onClose: () => void; onSaved: () => void }) {
  const isNew = !duration.id;
  const [form, setForm] = useState<Duration>(duration);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!form.label.trim()) return toast.error("Label required");
    if (!form.days || form.days < 1) return toast.error("Days must be ≥ 1");
    setBusy(true);
    try {
      if (isNew) {
        const { error } = await (supabase.from("platform_durations" as any) as any).insert({
          label: form.label.trim(), days: form.days, sort_order: form.sort_order, is_active: form.is_active,
        });
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("platform_durations" as any) as any).update({
          label: form.label.trim(), days: form.days, sort_order: form.sort_order, is_active: form.is_active,
        }).eq("id", form.id);
        if (error) throw error;
      }
      toast.success("Saved");
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm(`Delete duration "${form.label}"? Pricing rows for it will also be removed.`)) return;
    setBusy(true);
    const { error } = await (supabase.from("platform_durations" as any) as any).delete().eq("id", form.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "Add duration" : "Edit duration"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="30 Days" />
            </div>
            <div className="space-y-1.5">
              <Label>Days</Label>
              <Input type="number" value={form.days} onChange={(e) => setForm({ ...form, days: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1.5">
              <Label>Sort order</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1.5 flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                Active
              </label>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {!isNew && (
            <Button variant="outline" className="text-destructive" onClick={remove} disabled={busy}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
