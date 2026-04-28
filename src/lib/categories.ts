import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Tv, Sparkles, ShieldCheck, Package, Box, Music, Film, Gamepad2,
  BookOpen, Briefcase, Cloud, Code, GraduationCap, Headphones, Heart,
  Image as ImageIcon, Newspaper, Palette, Rocket, Smartphone, Star,
  Trophy, Video, Wrench, Zap, type LucideIcon,
} from "lucide-react";

export type Category = {
  id: string;
  name: string;
  icon: string;
  min_price: number;
  sort_order: number;
  is_active: boolean;
};

// Curated allowed icons (admin picks one of these)
export const ICON_MAP: Record<string, LucideIcon> = {
  Tv, Sparkles, ShieldCheck, Package, Box, Music, Film, Gamepad2,
  BookOpen, Briefcase, Cloud, Code, GraduationCap, Headphones, Heart,
  Image: ImageIcon, Newspaper, Palette, Rocket, Smartphone, Star,
  Trophy, Video, Wrench, Zap,
};

export const ICON_NAMES = Object.keys(ICON_MAP);

export const getCategoryIcon = (name?: string | null): LucideIcon =>
  (name && ICON_MAP[name]) || Package;

export function useCategories(opts?: { activeOnly?: boolean }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    let q = supabase.from("product_categories").select("*").order("sort_order", { ascending: true });
    if (opts?.activeOnly) q = q.eq("is_active", true);
    const { data } = await q;
    setCats((data as Category[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);
  return { cats, loading, reload };
}
