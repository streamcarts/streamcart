import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ReviewDialog } from "@/components/ReviewDialog";
import { Star, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  buyer_id: string;
  order_id: string;
  buyer_name?: string | null;
};

type Props = {
  productId: string;
  sellerId: string;
  serviceName: string;
  avgRating: number;
  ratingCount: number;
};

export const ProductReviews = ({ productId, sellerId, serviceName, avgRating, ratingCount }: Props) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [myOrder, setMyOrder] = useState<{ id: string } | null>(null);
  const [myReview, setMyReview] = useState<ReviewRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: revs } = await supabase
      .from("reviews")
      .select("id,rating,comment,created_at,buyer_id,order_id")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(20);
    const list = (revs as ReviewRow[]) ?? [];

    if (list.length) {
      const ids = Array.from(new Set(list.map((r) => r.buyer_id)));
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p.display_name]));
      list.forEach((r) => { r.buyer_name = map.get(r.buyer_id) ?? "User"; });
    }
    setReviews(list);

    if (user) {
      const { data: ord } = await supabase
        .from("orders")
        .select("id")
        .eq("buyer_id", user.id)
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setMyOrder(ord as any);
      const mine = list.find((r) => r.buyer_id === user.id) ?? null;
      setMyReview(mine);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, user?.id]);

  return (
    <section className="mt-12 border-t border-border pt-10">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <h2 className="text-2xl font-bold">Buyer reviews</h2>
          <div className="flex items-center gap-2 mt-1 text-sm">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={`h-4 w-4 ${n <= Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
              ))}
            </div>
            <span className="font-semibold">{Number(avgRating || 0).toFixed(2)}</span>
            <span className="text-muted-foreground">· {ratingCount} review{ratingCount === 1 ? "" : "s"}</span>
          </div>
        </div>

        {!user ? (
          <Button variant="outline" asChild>
            <Link to={`/auth?next=/product/${productId}`}>Sign in to review</Link>
          </Button>
        ) : myOrder ? (
          <ReviewDialog
            orderId={myOrder.id}
            productId={productId}
            sellerId={sellerId}
            serviceName={serviceName}
            existing={myReview ? { rating: myReview.rating, comment: myReview.comment } : null}
            onDone={load}
          />
        ) : (
          <span className="text-xs text-muted-foreground">Only verified buyers can review</span>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading reviews…</div>
      ) : reviews.length === 0 ? (
        <div className="card-elevated p-8 text-center text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No reviews yet. Be the first to share your experience.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl border border-border p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                    {(r.buyer_name ?? "U")[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{r.buyer_name}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                  ))}
                </div>
              </div>
              {r.comment && <p className="text-sm text-muted-foreground whitespace-pre-line">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
