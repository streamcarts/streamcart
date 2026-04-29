import { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { LucideIcon } from "lucide-react";

export const LegalLayout = ({
  icon: Icon,
  title,
  updated = "April 29, 2026",
  children,
}: {
  icon: LucideIcon;
  title: string;
  updated?: string;
  children: ReactNode;
}) => (
  <div className="min-h-screen flex flex-col bg-background">
    <Navbar />
    <main className="flex-1 container max-w-3xl py-14">
      <header className="mb-10">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <Icon className="h-6 w-6" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold">{title}</h1>
        <p className="text-muted-foreground mt-2">Last updated: {updated}</p>
      </header>
      <article className="space-y-8 text-foreground/90 leading-relaxed">{children}</article>
    </main>
    <Footer />
  </div>
);

export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="rounded-2xl border bg-card/40 p-6 shadow-sm">
    <h2 className="text-xl font-semibold mb-3 text-foreground">{title}</h2>
    <div className="text-muted-foreground space-y-2 text-[15px] leading-7">{children}</div>
  </section>
);

export const Bullets = ({ items }: { items: ReactNode[] }) => (
  <ul className="list-disc pl-5 space-y-1.5 marker:text-primary">
    {items.map((it, i) => (
      <li key={i}>{it}</li>
    ))}
  </ul>
);

export const SUPPORT_EMAIL = "support.streamcart@gmail.com";
export const SUPPORT_WHATSAPP = "+91 9473937978";
export const BUSINESS_ADDRESS = "Bheemapar, Near Royal Palace, Siddharth Nagar, UP 272207";
