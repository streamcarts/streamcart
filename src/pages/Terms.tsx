import { ScrollText } from "lucide-react";
import { LegalLayout, Section, Bullets, SUPPORT_EMAIL } from "@/components/LegalLayout";
import SEO from "@/components/SEO";

const Terms = () => {
  return (
    <>
      <SEO
        title="Terms & Conditions"
        description="Read the terms and conditions for using StreamCart — India's marketplace for premium digital subscriptions."
        path="/terms"
      />
    <LegalLayout icon={ScrollText} title="Terms & Conditions">
      <Section title="Acceptance">
        <p>
          By accessing or using StreamCart, you agree to follow these Terms & Conditions. If you do
          not agree with any part of these terms, please do not use the platform.
        </p>
      </Section>

      <Section title="Platform Role">
        <Bullets items={[
          "StreamCart is a marketplace that connects buyers and sellers of digital subscriptions",
          "We are not affiliated with, endorsed by, or partnered with brands like Netflix, Amazon Prime, etc.",
          "All trademarks belong to their respective owners",
        ]} />
      </Section>

      <Section title="User Responsibility">
        <Bullets items={[
          "Provide correct and genuine payment proof",
          "Do not misuse purchased accounts or share them outside the allowed terms",
          "Do not attempt fraud, chargebacks, or fake claims",
        ]} />
      </Section>

      <Section title="Seller Responsibility">
        <Bullets items={[
          "Provide valid, working credentials at the time of delivery",
          "Maintain product quality and replace credentials promptly if they fail",
          "Honor the duration and description listed in the product",
        ]} />
      </Section>

      <Section title="Payments">
        <Bullets items={[
          "Payments are made through UPI or other manual methods listed at checkout",
          "Orders are verified against your payment proof before access is delivered",
          "High-confidence payments may be auto-approved; others are reviewed manually",
        ]} />
      </Section>

      <Section title="Account Sharing Disclaimer">
        <p>
          Some subscriptions sold on StreamCart are shared accounts provided by sellers. By
          purchasing, you understand and accept that the access may be on a shared profile.
        </p>
      </Section>

      <Section title="Limitation of Liability">
        <p>
          StreamCart is not liable for disruptions, downtime, or policy changes caused by
          third-party service providers. Our maximum liability is limited to the value of the order
          in question.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          Accounts may be suspended or terminated for fraud, repeated chargebacks, abuse of the
          platform, or violation of these terms.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these Terms? Email{" "}
          <a className="text-primary underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </Section>
    </LegalLayout>
  );
};

export default Terms;
