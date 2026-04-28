import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCategories, ICON_NAMES, getCategoryIcon, type Category } from "@/lib/categories";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

export const CategoriesPanel = () => {
  const { cats, reload, loading } = useCategories();

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Marketplace categories</h2>
          <p className="text-xs text-muted-foreground">Add, edit or remove the categories sellers can list under. Set a minimum price to keep listings premium.</p>
        </div>
        <CategoryDialog onDone={reload} />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : cats.length === 0 ? (
        <div className="text-sm text-muted-foreground">No categories yet — add one above.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cats.map((c) => {
            const Icon = getCategoryIcon(c.icon);
            return (
              <div key={c.id} className="rounded-lg border border-border p-4 flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{c.name}</span>
                    {!c.is_active && <Badge variant="outline" className="text-xs">Disabled</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Min price: <span className="font-medium text-foreground">{c.min_price > 0 ? inr(c.min_price) : "Free"}</span>
                    <span className="mx-1.5">·</span>
                    Sort: {c.sort_order}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <CategoryDialog category={c} onDone={reload} />
                  <DeleteCategoryDialog category={c} onDone={reload} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

const CategoryDialog = ({ category, onDone }: { category?: Category; onDone: () => void }) => {
  const editing = !!category;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "Package");
  const [minPrice, setMinPrice] = useState(String(category?.min_price ?? 0));
  const [sort, setSort] = useState(String(category?.sort_order ?? 100));
  const [active, setActive] = useState(category?.is_active ?? true);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name required");
    const payload = {
      name: name.trim(),
      icon,
      min_price: Number(minPrice) || 0,
      sort_order: Number(sort) || 100,
      is_active: active,
    };
    setBusy(true);
    const { error } = editing
      ? await supabase.from("product_categories").update(payload).eq("id", category!.id)
      : await supabase.from("product_categories").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Category updated" : "Category added");
    setOpen(false);
    onDone();
  };

  const PreviewIcon = getCategoryIcon(icon);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing
          ? <Button size="icon" variant="ghost" className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>
          : <Button size="sm"><Plus className="h-4 w-4 mr-1.5" /> Add category</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
          </div>

          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <PreviewIcon className="h-5 w-5" />
              </div>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {ICON_NAMES.map((n) => {
                    const I = getCategoryIcon(n);
                    return (
                      <SelectItem key={n} value={n}>
                        <span className="inline-flex items-center gap-2"><I className="h-4 w-4" /> {n}</span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Min price (₹)</Label>
              <Input type="number" min="0" step="1" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">Sellers can't list below this.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Sort order</Label>
              <Input type="number" min="0" step="1" value={sort} onChange={(e) => setSort(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">Lower = shows first.</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label className="text-sm">Active</Label>
              <p className="text-[11px] text-muted-foreground">Disabled categories are hidden from buyers and sellers.</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Save changes" : "Add category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const DeleteCategoryDialog = ({ category, onDone }: { category: Category; onDone: () => void }) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete "{category.name}"?</AlertDialogTitle>
        <AlertDialogDescription>
          Existing products in this category will stay live but new listings won't be possible. Tip: just disable it instead if you want to keep history clean.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={async () => {
          const { error } = await supabase.from("product_categories").delete().eq("id", category.id);
          if (error) return toast.error(error.message);
          toast.success("Category deleted");
          onDone();
        }}>Delete</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
