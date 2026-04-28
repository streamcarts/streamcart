import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ScrollText } from "lucide-react";

const Terms = () => {
  useEffect(() => {
    document.title = "Terms of Service — StreamCart";
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container max-w-3xl py-14">
        <header className="mb-10">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <ScrollText className="h-6 w-6" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">Terms of Service</h1>
          <p className="text-muted-foreground mt-2">Last updated: April 28, 2026</p>
        </header>

        <article className="prose prose-sm max-w-none space-y-6 text-foreground/90 leading-relaxed">
          <Section title="1. Acceptance of Terms">
            By accessing or using StreamCart (“the Platform”), you agree to be bound by these Terms.
            If you do not agree, please do not use the Platform.
          </Section>

          <Section title="2. What StreamCart is">
            StreamCart is a marketplace that connects buyers seeking short-term access to digital
            subscriptions with verified independent sellers. We facilitate the transaction; the
            underlying services (e.g. Netflix, ChatGPT) are owned by their respective companies.
          </Section>

          <Section title="3. Account & Eligibility">
            You must be 18 years or older to register. You are responsible for keeping your account
            credentials secure and for all activity under your account.
          </Section>

          <Section title="4. Payments & Wallet">
            All payments made on StreamCart pass through your secure wallet. Funds added to your
            wallet are non-transferable. Prices are inclusive of platform fees.
          </Section>

          <Section title="5. Seller Obligations">
            Sellers must deliver working credentials within the agreed duration and respond to
            buyer queries promptly. Selling stolen, illegally obtained, or non-functional access
            is strictly prohibited.
          </Section>

          <Section title="6. Buyer Obligations">
            Buyers may not share, resell, or redistribute credentials received through StreamCart.
            Misuse will result in account suspension without refund.
          </Section>

          <Section title="7. Prohibited Conduct">
            Fraud, chargeback abuse, multi-accounting, scraping, or any attempt to circumvent
            platform fees will result in permanent bans and forfeiture of wallet balance.
          </Section>

          <Section title="8. Limitation of Liability">
            StreamCart is not responsible for service interruptions caused by the underlying
            subscription provider. Our maximum liability is limited to the value of the order in
            question.
          </Section>

          <Section title="9. Changes to Terms">
            We may update these Terms from time to time. Continued use of the Platform after
            changes are posted constitutes acceptance.
          </Section>

          <Section title="10. Contact">
            Questions about these Terms? Email <a className="text-primary underline" href="mailto:support@streamcart.app">support@streamcart.app</a>.
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

export default Terms;
