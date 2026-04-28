import { useEffect, useState } from "react";
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
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useCategories, ICON_NAMES, getCategoryIcon, type Category } from "@/lib/categories";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, ChevronDown, Users, User, Layers } from "lucide-react";

type AccountType = "private" | "shared";

type CategoryItem = {
  id: string;
  category_id: string;
  name: string;
  icon: string;
  price: number;
  account_type: AccountType;
  sort_order: number;
  is_active: boolean;
};

export const CategoriesPanel = () => {
  const { cats, reload, loading } = useCategories();

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Marketplace categories</h2>
          <p className="text-xs text-muted-foreground">Manage categories, then expand each to add items (sub-services) with their own price, icon and account type (private / shared).</p>
        </div>
        <CategoryDialog onDone={reload} />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : cats.length === 0 ? (
        <div className="text-sm text-muted-foreground">No categories yet — add one above.</div>
      ) : (
        <div className="space-y-3">
          {cats.map((c) => <CategoryRow key={c.id} category={c} onChange={reload} />)}
        </div>
      )}
    </Card>
  );
};

const CategoryRow = ({ category, onChange }: { category: Category; onChange: () => void }) => {
  const Icon = getCategoryIcon(category.icon);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("category_items")
      .select("*")
      .eq("category_id", category.id)
      .order("sort_order", { ascending: true });
    setItems((data as CategoryItem[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (open) loadItems(); /* eslint-disable-next-line */ }, [open, category.id]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border border-border">
      <div className="p-4 flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{category.name}</span>
            {!category.is_active && <Badge variant="outline" className="text-xs">Disabled</Badge>}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Min price: <span className="font-medium text-foreground">{category.min_price > 0 ? inr(category.min_price) : "Free"}</span>
            <span className="mx-1.5">·</span>
            Sort: {category.sort_order}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <CollapsibleTrigger asChild>
            <Button size="sm" variant="ghost" className="gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Items</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CategoryDialog category={category} onDone={onChange} />
          <DeleteCategoryDialog category={category} onDone={onChange} />
        </div>
      </div>

      <CollapsibleContent>
        <div className="border-t border-border p-4 bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Items in {category.name}</h4>
            <ItemDialog categoryId={category.id} onDone={loadItems} />
          </div>

          {loading ? (
            <div className="text-xs text-muted-foreground">Loading items…</div>
          ) : items.length === 0 ? (
            <div className="text-xs text-muted-foreground py-3 text-center">No items yet — add one above.</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {items.map((it) => {
                const II = getCategoryIcon(it.icon);
                return (
                  <div key={it.id} className="rounded-lg border border-border bg-background p-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      <II className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold truncate">{it.name}</span>
                        {!it.is_active && <Badge variant="outline" className="text-[10px] px-1 py-0">Off</Badge>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                        <span className="font-medium text-primary">{inr(it.price)}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-0.5">
                          {it.account_type === "private"
                            ? <><User className="h-3 w-3" /> Private</>
                            : <><Users className="h-3 w-3" /> Shared</>}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <ItemDialog categoryId={category.id} item={it} onDone={loadItems} />
                      <DeleteItemDialog item={it} onDone={loadItems} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

// =================== CATEGORY DIALOG ===================

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
          All items inside will be deleted too. Existing products in this category will stay live but new listings won't be possible.
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

// =================== ITEM DIALOG ===================

const ItemDialog = ({ categoryId, item, onDone }: { categoryId: string; item?: CategoryItem; onDone: () => void }) => {
  const editing = !!item;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(item?.name ?? "");
  const [icon, setIcon] = useState(item?.icon ?? "Package");
  const [price, setPrice] = useState(String(item?.price ?? 0));
  const [accountType, setAccountType] = useState<AccountType>(item?.account_type ?? "shared");
  const [sort, setSort] = useState(String(item?.sort_order ?? 100));
  const [active, setActive] = useState(item?.is_active ?? true);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name required");
    const payload = {
      category_id: categoryId,
      name: name.trim(),
      icon,
      price: Number(price) || 0,
      account_type: accountType,
      sort_order: Number(sort) || 100,
      is_active: active,
    };
    setBusy(true);
    const { error } = editing
      ? await supabase.from("category_items").update(payload).eq("id", item!.id)
      : await supabase.from("category_items").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Item updated" : "Item added");
    setOpen(false);
    onDone();
  };

  const PreviewIcon = getCategoryIcon(icon);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing
          ? <Button size="icon" variant="ghost" className="h-7 w-7"><Pencil className="h-3 w-3" /></Button>
          : <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1.5" /> Add item</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Edit item" : "New item"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Item name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Netflix Premium" maxLength={60} required />
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
              <Label>Price (₹)</Label>
              <Input type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Account type</Label>
              <Select value={accountType} onValueChange={(v) => setAccountType(v as AccountType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">
                    <span className="inline-flex items-center gap-2"><User className="h-4 w-4" /> Private</span>
                  </SelectItem>
                  <SelectItem value="shared">
                    <span className="inline-flex items-center gap-2"><Users className="h-4 w-4" /> Shared</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Sort order</Label>
              <Input type="number" min="0" step="1" value={sort} onChange={(e) => setSort(e.target.value)} />
            </div>
            <div className="flex items-end justify-between rounded-lg border border-border p-3">
              <Label className="text-sm">Active</Label>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const DeleteItemDialog = ({ item, onDone }: { item: CategoryItem; onDone: () => void }) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
        <Trash2 className="h-3 w-3" />
      </Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete "{item.name}"?</AlertDialogTitle>
        <AlertDialogDescription>This item will be permanently removed.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={async () => {
          const { error } = await supabase.from("category_items").delete().eq("id", item.id);
          if (error) return toast.error(error.message);
          toast.success("Item deleted");
          onDone();
        }}>Delete</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
