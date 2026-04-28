import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductGridSkeleton } from "@/components/ProductCardSkeleton";
import { ProductCard, ratingFor } from "@/components/ProductCard";
import { inr } from "@/lib/format";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Search, Star, Filter, X, LayoutGrid } from "lucide-react";
import { useCategories, getCategoryIcon } from "@/lib/categories";

type Product = {
  id: string;
  service_name: string;
  category: string;
  description: string | null;
  display_price: number;
  duration: string | null;
  image_url: string | null;
  stock: number;
};

// Categories are now loaded dynamically from product_categories table
type SortKey = "newest" | "price_asc" | "price_desc" | "popular";

const Browse = () => {
  const [params, setParams] = useSearchParams();
  const { cats: dbCats } = useCategories({ activeOnly: true });

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(params.get("q") || "");
  const [showSuggest, setShowSuggest] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<SortKey>("newest");
  const [showFilters, setShowFilters] = useState(false);

  const cat = params.get("cat") || "All";

  useEffect(() => {
    document.title = "Browse services — StreamCart";
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat]);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("products")
      .select("id,service_name,category,description,display_price,duration,image_url,stock")
      .eq("status", "approved")
      .eq("is_active", true)
      .gt("stock", 0)
      .order("created_at", { ascending: false });
    if (cat !== "All") query = query.eq("category", cat as any);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    setProducts((data as Product[]) ?? []);
    setLoading(false);
  };

  // Deterministic synthetic rating per product (shared with ProductCard)
  // ratingFor imported from ProductCard

  const filtered = useMemo(() => {
    let list = products
      .filter((p) => !q.trim() || p.service_name.toLowerCase().includes(q.toLowerCase()) || (p.description?.toLowerCase().includes(q.toLowerCase()) ?? false))
      .filter((p) => Number(p.display_price) >= priceRange[0] && Number(p.display_price) <= priceRange[1])
      .filter((p) => ratingFor(p.id) >= minRating);

    if (sort === "price_asc") list = [...list].sort((a, b) => Number(a.display_price) - Number(b.display_price));
    else if (sort === "price_desc") list = [...list].sort((a, b) => Number(b.display_price) - Number(a.display_price));
    else if (sort === "popular") list = [...list].sort((a, b) => ratingFor(b.id) - ratingFor(a.id));
    return list;
  }, [products, q, priceRange, minRating, sort]);

  const suggestions = useMemo(() => {
    if (!q.trim()) return [];
    const t = q.toLowerCase();
    return products.filter((p) => p.service_name.toLowerCase().includes(t)).slice(0, 5);
  }, [q, products]);

  // Add-to-cart logic now lives in the shared <ProductCard />

  const activeFilters = (cat !== "All" ? 1 : 0) + (priceRange[0] > 0 || priceRange[1] < 5000 ? 1 : 0) + (minRating > 0 ? 1 : 0);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container py-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Browse services</h1>
            <p className="text-muted-foreground">Approved listings — instant credential delivery.</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 pr-9"
              placeholder="Search Netflix, ChatGPT, VPN…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
            {showSuggest && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 card-elevated p-1 z-30 max-h-72 overflow-auto">
                {suggestions.map((s) => (
                  <Link
                    key={s.id} to={`/product/${s.id}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-sm"
                  >
                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {s.service_name[0]}
                    </div>
                    <div className="flex-1 min-w-0 truncate">{s.service_name}</div>
                    <div className="text-xs text-primary font-semibold">{inr(s.display_price)}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2 mb-4">
          {CATS.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={cat === c ? "default" : "outline"}
              onClick={() => {
                const next = new URLSearchParams(params);
                if (c === "All") next.delete("cat"); else next.set("cat", c);
                setParams(next);
              }}
            >
              {c}
            </Button>
          ))}
        </div>

        {/* Sort + filter toggle */}
        <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-border">
          <Button size="sm" variant="outline" onClick={() => setShowFilters((v) => !v)}>
            <Filter className="h-4 w-4 mr-1.5" /> Filters
            {activeFilters > 0 && <Badge variant="secondary" className="ml-2 h-5 px-1.5">{activeFilters}</Badge>}
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">{filtered.length} results</span>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="popular">Most popular</SelectItem>
                <SelectItem value="price_asc">Price: low to high</SelectItem>
                <SelectItem value="price_desc">Price: high to low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="card-elevated p-5 mb-6 grid md:grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-200">
            <div>
              <div className="flex justify-between mb-3">
                <label className="text-sm font-medium">Price range</label>
                <span className="text-xs text-muted-foreground">{inr(priceRange[0])} – {inr(priceRange[1])}</span>
              </div>
              <Slider
                min={0} max={5000} step={50}
                value={priceRange}
                onValueChange={(v) => setPriceRange([v[0], v[1]] as [number, number])}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-3">Minimum rating</label>
              <div className="flex gap-2">
                {[0, 4, 4.5, 4.8].map((r) => (
                  <Button
                    key={r}
                    size="sm"
                    variant={minRating === r ? "default" : "outline"}
                    onClick={() => setMinRating(r)}
                  >
                    {r === 0 ? "Any" : <><Star className="h-3 w-3 mr-1 fill-current" />{r}+</>}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <ProductGridSkeleton count={6} />
        ) : filtered.length === 0 ? (
          <div className="card-elevated p-12 text-center text-muted-foreground">
            No services match your filters.
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={() => { setQ(""); setPriceRange([0, 5000]); setMinRating(0); }}>Clear filters</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Browse;
