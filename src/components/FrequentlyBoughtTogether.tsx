import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import { Plus } from "lucide-react";

type Item = {
  id: string;
  slug: string | null;
  service_name: string;
  display_price: number;
  image_url: string | null;
  category: string;
};

type Props = { productId: string; category: string };

export const FrequentlyBoughtTogether = ({ productId, category }: Props) => {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id, slug, service_name, display_price, image_url, category")
        .eq("status", "approved")
        .eq("is_active", true)
        .eq("category", category)
        .neq("id", productId)
        .gt("stock", 0)
        .order("rating_count", { ascending: false })
        .limit(3);
      setItems((data as Item[]) ?? []);
    })();
  }, [productId, category]);

  if (items.length === 0) return null;

  return (
    <section className="mt-12 border-t border-border pt-8">
      <h2 className="text-xl font-bold mb-1">Frequently bought together</h2>
      <p className="text-sm text-muted-foreground mb-4">Other buyers in {category} also picked these.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map((it, i) => (
          <div key={it.id} className="relative">
            {i > 0 && (
              <Plus className="hidden sm:block absolute -left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground bg-background rounded-full z-10" />
            )}
            <Link
              to={`/p/${it.slug ?? it.id}`}
              className="group flex items-center gap-3 p-3 border border-border rounded-xl hover:border-primary/40 hover:shadow-md transition-all"
            >
              <div className="h-14 w-14 rounded-lg bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                {it.image_url ? (
                  <img src={it.image_url} alt={it.service_name} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-muted-foreground">{it.service_name[0]}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">{it.service_name}</div>
                <div className="text-sm font-bold text-primary mt-0.5">{inr(it.display_price)}</div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
};
