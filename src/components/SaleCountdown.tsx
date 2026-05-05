import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

type Props = { endsAt: string | null | undefined };

const pad = (n: number) => String(n).padStart(2, "0");

export const SaleCountdown = ({ endsAt }: Props) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!endsAt) return null;
  const end = new Date(endsAt).getTime();
  const diff = end - now;
  if (isNaN(end) || diff <= 0) return null;

  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 flex items-center gap-3">
      <Flame className="h-5 w-5 text-destructive shrink-0 animate-pulse" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-destructive uppercase tracking-wider">Flash sale ends in</div>
        <div className="font-mono text-lg font-bold tabular-nums">
          {pad(h)}<span className="text-destructive/60">:</span>{pad(m)}<span className="text-destructive/60">:</span>{pad(s)}
        </div>
      </div>
    </div>
  );
};
