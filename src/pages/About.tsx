import { Sparkles, ShieldCheck, Wallet, Headphones, MessageCircle, Mail } from "lucide-react";
import { LegalLayout, Section, Bullets, SUPPORT_EMAIL, SUPPORT_WHATSAPP, BUSINESS_ADDRESS } from "@/components/LegalLayout";
import SEO from "@/components/SEO";

const About = () => {
  const waLink = `https://wa.me/${SUPPORT_WHATSAPP.replace(/[^0-9]/g, "")}`;

  return (
    <>
      <SEO
        title="About Us"
        description="StreamCart is India's trusted marketplace for premium digital subscriptions — Netflix, ChatGPT, Spotify and more at the lowest prices."
        path="/about"
      />
    <LegalLayout icon={Sparkles} title="About StreamCart">
      <Section title="Who We Are">
        <p>
          StreamCart is a digital subscription marketplace that helps users access premium online
          services at affordable prices. From OTT platforms to AI tools and software, we make
          short-term access simple, fast, and trustworthy.
        </p>
      </Section>

      <Section title="Our Mission">
        <p>
          To make premium digital services more accessible and cost-effective for everyone in India
          — without long lock-ins or surprise fees.
        </p>
      </Section>

      <Section title="What We Offer">
        <Bullets items={[
          "Short-term access to OTT subscriptions",
          "AI tools and productivity software",
          "Verified seller listings with quick delivery",
          "Wallet, affiliate, and refer-and-earn rewards",
        ]} />
      </Section>

      <Section title="Why Choose Us">
        <div className="grid sm:grid-cols-2 gap-3 pt-1">
          <Feature icon={ShieldCheck} title="Verified Sellers" desc="Every seller is reviewed for quality and reliability." />
          <Feature icon={Wallet} title="Affordable Pricing" desc="Pay only for what you need, when you need it." />
          <Feature icon={Headphones} title="Quick Support" desc="Real humans helping you over email and WhatsApp." />
          <Feature icon={Sparkles} title="Fast Delivery" desc="Most orders are delivered within minutes of payment." />
        </div>
      </Section>

      <Section title="Contact Us">
        <div className="grid sm:grid-cols-2 gap-3">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="flex items-center gap-3 rounded-xl border bg-background p-4 hover:border-primary/50 transition"
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <Mail className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">Email</div>
              <div className="text-xs text-muted-foreground truncate">{SUPPORT_EMAIL}</div>
            </div>
          </a>
          <a
            href={waLink}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border bg-background p-4 hover:border-primary/50 transition"
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">WhatsApp</div>
              <div className="text-xs text-muted-foreground truncate">{SUPPORT_WHATSAPP}</div>
            </div>
          </a>
        </div>
        <p className="text-xs text-muted-foreground pt-3">Address: {BUSINESS_ADDRESS}</p>
      </Section>
    </LegalLayout>
    </>
  );
};

const Feature = ({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) => (
  <div className="flex items-start gap-3 rounded-xl border bg-background p-4">
    <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center flex-shrink-0">
      <Icon className="h-4 w-4" />
    </div>
    <div>
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
    </div>
  </div>
);

export default About;
