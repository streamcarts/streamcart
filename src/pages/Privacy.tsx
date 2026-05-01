import { Shield } from "lucide-react";
import { LegalLayout, Section, Bullets, SUPPORT_EMAIL, BUSINESS_ADDRESS } from "@/components/LegalLayout";
import SEO from "@/components/SEO";

const Privacy = () => {
  return (
    <>
      <SEO
        title="Privacy Policy"
        description="How StreamCart collects, uses, and protects your data when you buy premium subscriptions on our marketplace."
        path="/privacy"
      />
    <LegalLayout icon={Shield} title="Privacy Policy">
      <Section title="Introduction">
        <p>
          StreamCart respects your privacy. We collect only the limited information needed to deliver
          your orders securely, verify payments, and provide reliable support. This policy explains
          what we collect, how we use it, and the choices you have.
        </p>
      </Section>

      <Section title="Data We Collect">
        <Bullets items={[
          "Name, email, and phone number (if provided)",
          "Order details such as products purchased, price, and timestamps",
          "Payment proof including UPI screenshot and transaction ID",
          "Basic device and usage data such as IP address and browser type",
        ]} />
      </Section>

      <Section title="How We Use Your Data">
        <Bullets items={[
          "To process your orders and deliver subscription access",
          "To verify payments and prevent fraud or misuse",
          "To provide customer support and resolve issues",
          "To improve platform performance and user experience",
        ]} />
      </Section>

      <Section title="Data Sharing">
        <Bullets items={[
          "We do not sell your personal data to anyone",
          "We share data only with trusted service providers (hosting, support tools) when required to operate the platform",
          "We may disclose information if required by law or a valid legal request",
        ]} />
      </Section>

      <Section title="Data Security">
        <Bullets items={[
          "Data is stored securely with restricted access controls",
          "Sensitive information is masked wherever possible",
          "We continuously review our security practices",
        ]} />
      </Section>

      <Section title="Cookies">
        <p>
          We use minimal cookies — only what is needed for login sessions and basic analytics to
          understand how the platform is being used.
        </p>
      </Section>

      <Section title="Your Rights">
        <Bullets items={[
          "You can request correction of your personal data",
          "You can request deletion of your account and data",
          "Just contact our support team and we will respond within a reasonable time",
        ]} />
      </Section>

      <Section title="Contact">
        <p>
          Email: <a className="text-primary underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a><br />
          Address: {BUSINESS_ADDRESS}
        </p>
      </Section>
    </LegalLayout>
    </>
  );
};

export default Privacy;
