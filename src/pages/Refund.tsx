import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { LegalLayout, Section, Bullets, SUPPORT_EMAIL } from "@/components/LegalLayout";

const Refund = () => {
  useEffect(() => {
    document.title = "Refund Policy — StreamCart";
  }, []);

  return (
    <LegalLayout icon={RefreshCw} title="Refund Policy">
      <Section title="General Policy">
        <p>
          Because StreamCart deals with digital products and subscription credentials, refunds are
          limited. We always try to resolve issues with a replacement first, and only refund when a
          fair solution is not possible.
        </p>
      </Section>

      <Section title="Eligible for Refund">
        <Bullets items={[
          "Login credentials were not delivered within the promised time",
          "Credentials did not work at the time of delivery",
          "The product received was significantly different from the description",
        ]} />
      </Section>

      <Section title="Not Eligible for Refund">
        <Bullets items={[
          "You changed your mind after the purchase",
          "Account was misused, shared further, or password was changed by the buyer",
          "The subscription period has expired",
        ]} />
      </Section>

      <Section title="Replacement First">
        <p>
          If a login fails, we will provide a working replacement first. A refund is offered only if
          a working replacement is not possible.
        </p>
      </Section>

      <Section title="Refund Time">
        <p>Approved refunds are processed to your wallet or original payment method within 3–7 working days.</p>
      </Section>

      <Section title="Verification">
        <p>
          For any refund or replacement request, you may be asked to provide proof such as
          screenshots, error messages, or order details so we can verify the issue quickly.
        </p>
      </Section>

      <Section title="How to Request">
        <p>
          Email <a className="text-primary underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{" "}
          with your order ID and the issue you faced. Our team will respond as soon as possible.
        </p>
      </Section>
    </LegalLayout>
  );
};

export default Refund;
