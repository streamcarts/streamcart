import { Link } from "react-router-dom";
import { Logo } from "./Logo";
import { Mail, Twitter, Instagram, Shield } from "lucide-react";

export const Footer = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 bg-[hsl(222,28%,10%)] text-white/80">
      <div className="container py-14 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2 md:col-span-1 space-y-4">
          <div className="text-white">
            <Logo size={32} />
          </div>
          <p className="text-sm text-white/60 max-w-xs">
            India's trusted marketplace for short-term access to premium digital subscriptions.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <a href="#" className="h-8 w-8 grid place-items-center rounded-full bg-white/5 hover:bg-white/10 transition-colors" aria-label="Twitter"><Twitter className="h-4 w-4" /></a>
            <a href="#" className="h-8 w-8 grid place-items-center rounded-full bg-white/5 hover:bg-white/10 transition-colors" aria-label="Instagram"><Instagram className="h-4 w-4" /></a>
            <a href="mailto:hello@streamcart.app" className="h-8 w-8 grid place-items-center rounded-full bg-white/5 hover:bg-white/10 transition-colors" aria-label="Email"><Mail className="h-4 w-4" /></a>
          </div>
        </div>

        <FooterCol title="Marketplace" links={[
          { label: "Browse services", to: "/browse" },
          { label: "Become a seller", to: "/sell" },
          { label: "Affiliate program", to: "/affiliate" },
        ]} />

        <FooterCol title="Account" links={[
          { label: "Sign in", to: "/auth" },
          { label: "Buyer dashboard", to: "/buyer" },
          { label: "Seller dashboard", to: "/seller" },
        ]} />

        <FooterCol title="Legal" links={[
          { label: "Terms of service", to: "#" },
          { label: "Privacy policy", to: "#" },
          { label: "Refund policy", to: "#" },
        ]} />
      </div>

      <div className="border-t border-white/10">
        <div className="container py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/50">
          <p>© {year} StreamCart. All rights reserved.</p>
          <p className="inline-flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-primary" /> Secure payments · Vetted vendors · Instant delivery</p>
        </div>
      </div>
    </footer>
  );
};

const FooterCol = ({ title, links }: { title: string; links: { label: string; to: string }[] }) => (
  <div>
    <h4 className="text-sm font-semibold text-white mb-4">{title}</h4>
    <ul className="space-y-2.5 text-sm">
      {links.map((l) => (
        <li key={l.label}>
          <Link to={l.to} className="text-white/60 hover:text-white transition-colors">{l.label}</Link>
        </li>
      ))}
    </ul>
  </div>
);
