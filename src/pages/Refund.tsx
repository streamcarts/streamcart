import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { RefreshCw, CheckCircle2, XCircle } from "lucide-react";

const Refund = () => {
  useEffect(() => {
    document.title = "Refund Policy — StreamCart";
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container max-w-3xl py-14">
        <header className="mb-10">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <RefreshCw className="h-6 w-6" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">Refund Policy</h1>
          <p className="text-muted-foreground mt-2">Fair, fast, and transparent.</p>
        </header>

        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 text-primary font-semibold mb-2">
              <CheckCircle2 className="h-5 w-5" /> When you get a refund
            </div>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
              <li>Credentials don't work at delivery</li>
              <li>Access expires before promised duration</li>
              <li>Seller fails to respond within 24 hours</li>
              <li>Duplicate / failed payment</li>
            </ul>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 text-destructive font-semibold mb-2">
              <XCircle className="h-5 w-5" /> When refunds don't apply
            </div>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
              <li>You changed your mind after access worked</li>
              <li>Misuse / sharing of credentials</li>
              <li>Underlying provider banned the shared account due to your activity</li>
              <li>Refund requested after expiry of order duration</li>
            </ul>
          </div>
        </div>

        <article className="space-y-6 leading-relaxed">
          <Section title="1. How to request a refund">
            Open your buyer dashboard → Orders → click <strong>Raise Ticket</strong> on the
            affected order. Our support team responds within a few hours.
          </Section>

          <Section title="2. Refund timelines">
            Approved refunds are credited back to your StreamCart wallet instantly. From the
            wallet, payouts to the original payment method take 3–7 business days depending on
            your bank.
          </Section>

          <Section title="3. Partial refunds">
            If access stopped working partway through the duration, you receive a pro-rated
            refund for the unused days.
          </Section>

          <Section title="4. Disputes">
            If a refund is denied, you can escalate to our admin team via the support ticket. The
            admin's decision after reviewing both sides is final.
          </Section>

          <Section title="5. Contact">
            Need help? Email <a className="text-primary underline" href="mailto:support@streamcart.app">support@streamcart.app</a> — we respond 24/7.
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

export default Refund;
