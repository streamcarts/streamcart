import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageOff } from "lucide-react";

interface Props {
  bucket: string;
  path?: string | null;
  className?: string;
}

export const SignedThumbnail = ({ bucket, path, className }: Props) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!path) { setLoading(false); return; }
    supabase.storage.from(bucket).createSignedUrl(path, 3600).then(({ data }) => {
      if (alive) { setUrl(data?.signedUrl ?? null); setLoading(false); }
    });
    return () => { alive = false; };
  }, [bucket, path]);

  if (!path) return (
    <div className={`flex items-center justify-center bg-muted rounded text-muted-foreground ${className ?? "h-12 w-12"}`}>
      <ImageOff className="h-4 w-4" />
    </div>
  );
  if (loading) return <Skeleton className={className ?? "h-12 w-12 rounded"} />;
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
      <img src={url} alt="proof" className={`object-cover rounded border border-border ${className ?? "h-12 w-12"}`} />
    </a>
  );
};
