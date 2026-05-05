import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag } from "lucide-react";

type Row = { service_name: string; created_at: string };

const FIRST_NAMES = ["Aarav", "Priya", "Rohit", "Ananya", "Vikram", "Sneha", "Arjun", "Kavya", "Rahul", "Isha", "Karan", "Meera", "Dev", "Nisha", "Aman"];
const CITIES = ["Mumbai", "Delhi", "Bengaluru", "Pune", "Hyderabad", "Chennai", "Kolkata", "Jaipur", "Lucknow", "Ahmedabad"];

const pickAnon = (seed: number) => {
  const name = FIRST_NAMES[seed % FIRST_NAMES.length];
  const city = CITIES[(seed * 7) % CITIES.length];
  return `${name} from ${city}`;
};

const minsAgo = (iso: string) => {
  const m = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export const RecentOrdersTicker = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    supabase
      .from("orders")
      .select("service_name, created_at")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, []);

  useEffect(() => {
    if (rows.length < 2) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % rows.length), 3500);
    return () => clearInterval(id);
  }, [rows.length]);

  if (rows.length === 0) return null;
  const current = rows[idx];

  return (
    <div className="container py-3">
      <div
        key={idx}
        className="mx-auto max-w-md flex items-center gap-2.5 px-4 py-2.5 rounded-full border border-primary/20 bg-primary/5 text-sm shadow-sm animate-fade-in"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
        <ShoppingBag className="h-4 w-4 text-primary shrink-0" />
        <span className="truncate">
          <strong className="text-foreground">{pickAnon(idx)}</strong>
          <span className="text-muted-foreground"> bought </span>
          <strong className="text-foreground">{current.service_name}</strong>
          <span className="text-muted-foreground"> · {minsAgo(current.created_at)}</span>
        </span>
      </div>
    </div>
  );
};
