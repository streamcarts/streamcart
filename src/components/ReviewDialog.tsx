import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

type Props = {
  orderId: string;
  productId: string;
  sellerId: string;
  serviceName: string;
  existing?: { rating: number; comment: string | null } | null;
  onDone?: () => void;
};

export const ReviewDialog = ({ orderId, productId, sellerId, serviceName, existing, onDone }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRating(existing?.rating ?? 0);
    setComment(existing?.comment ?? "");
  }, [existing]);

  const submit = async () => {
    if (!rating) return toast.error("Pick a rating");
    setBusy(true);
    const payload = {
      order_id: orderId, product_id: productId, seller_id: sellerId,
      buyer_id: user!.id, rating, comment: comment.trim() || null,
    };
    const { error } = existing
      ? await supabase.from("reviews").update({ rating, comment: comment.trim() || null }).eq("order_id", orderId)
      : await supabase.from("reviews").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Review updated" : "Thanks for your review!");
    setOpen(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Star className={`h-3.5 w-3.5 mr-1.5 ${existing ? "fill-amber-400 text-amber-400" : ""}`} />
          {existing ? `Your rating: ${existing.rating}★` : "Rate seller"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Rate "{serviceName}"</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-1 py-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} className="p-1 transition-transform hover:scale-110">
                <Star className={`h-9 w-9 ${(hover || rating) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>Comment (optional)</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={3} placeholder="How was your experience?" />
          </div>
          <Button onClick={submit} className="w-full" disabled={busy || !rating}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {existing ? "Update review" : "Submit review"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
