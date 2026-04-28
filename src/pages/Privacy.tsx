import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ShieldCheck } from "lucide-react";

const Privacy = () => {
  useEffect(() => {
    document.title = "Privacy Policy — StreamCart";
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container max-w-3xl py-14">
        <header className="mb-10">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">Privacy Policy</h1>
          <p className="text-muted-foreground mt-2">Last updated: April 28, 2026</p>
        </header>

        <article className="space-y-6 leading-relaxed">
          <Section title="1. What we collect">
            We collect the minimum data needed to run the marketplace: your email, optional
            display name, transaction history, IP address, and basic device fingerprint for fraud
            prevention.
          </Section>

          <Section title="2. How we use your data">
            Your data is used to: deliver purchased credentials, process payments, prevent abuse,
            send order updates, and improve the Platform. We never sell your personal data to
            third parties.
          </Section>

          <Section title="3. Cookies & Tracking">
            We use essential cookies for authentication and a minimal first-party analytics layer
            to understand how users navigate StreamCart. You can clear cookies any time from your
            browser settings.
          </Section>

          <Section title="4. Data Sharing">
            We share data only with: (a) payment processors to complete transactions, (b) sellers
            for order fulfilment (limited to order ID and delivery info), and (c) law enforcement
            if legally required.
          </Section>

          <Section title="5. Data Security">
            All passwords are hashed. Wallet balances and credentials are encrypted at rest. We
            run regular security audits and limit internal access on a need-to-know basis.
          </Section>

          <Section title="6. Data Retention">
            Account data is retained while your account is active. You can request deletion at any
            time by emailing us; we will remove personal data within 30 days, retaining only what
            is legally required.
          </Section>

          <Section title="7. Your Rights">
            You have the right to access, correct, export, or delete your personal data. Contact
            <a className="text-primary underline ml-1" href="mailto:privacy@streamcart.app">privacy@streamcart.app</a>
            to exercise these rights.
          </Section>

          <Section title="8. Children">
            StreamCart is not directed at children under 18. We do not knowingly collect data from
            minors.
          </Section>

          <Section title="9. Changes">
            We will notify you of material changes via email or in-app announcement.
          </Section>
        </article>
      </main>
      <Footer />
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <h2 className="text-lg font-semibold mb-2">{title}</h2>
    <p className="text-muted-foreground">{children}</p>
  </section>
);

export default Privacy;
