import { Link } from "react-router-dom";
import { Logo } from "./Logo";
import { Mail, Twitter, Instagram, Shield, Headphones, RefreshCw, Zap } from "lucide-react";

export const Footer = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 bg-[hsl(222,28%,10%)] text-white/80">
      {/* Trust ribbon */}
      <div className="border-b border-white/10 bg-white/[0.02]">
        <div className="container py-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <TrustRow icon={Headphones} title="24/7 Support" sub="Real humans, not bots" />
          <TrustRow icon={RefreshCw} title="Refund Guarantee" sub="If access fails, you get refunded" />
          <TrustRow icon={Shield} title="100% Secure" sub="Encrypted payments & wallet" />
        </div>
      </div>

      <div className="container py-14 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2 md:col-span-1 space-y-4">
          <div className="text-white">
            <Logo size={32} />
          </div>
          <p className="text-sm text-white/60 max-w-xs">
            India's trusted marketplace for short-term access to premium digital subscriptions.
          </p>
          <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-primary">
            <Zap className="h-3 w-3" /> Secure · Fast · Reliable
          </div>
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
          { label: "Terms of service", to: "/terms" },
          { label: "Privacy policy", to: "/privacy" },
          { label: "Refund policy", to: "/refund" },
        ]} />
      </div>

      <div className="border-t border-white/10">
        <div className="container py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/50">
          <p>© {year} StreamCart. All rights reserved.</p>
          <p className="inline-flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-primary" />
            Secure payments · Vetted vendors · Instant delivery
          </p>
        </div>
      </div>
    </footer>
  );
};

const TrustRow = ({ icon: Icon, title, sub }: { icon: any; title: string; sub: string }) => (
  <div className="flex items-center gap-3 px-1">
    <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
      <Icon className="h-4 w-4" />
    </div>
    <div className="min-w-0">
      <div className="text-white font-semibold text-sm leading-tight truncate">{title}</div>
      <div className="text-white/50 text-[11px] truncate">{sub}</div>
    </div>
  </div>
);

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
