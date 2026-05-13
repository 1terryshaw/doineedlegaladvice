import { Metadata } from "next";
import verticalConfig from "@/lib/vertical.config";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms of Service for ${verticalConfig.name}`,
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: March 24, 2026</p>

      <div className="prose max-w-none space-y-6 text-gray-700">
        <section>
          <h2 className="text-xl font-semibold text-gray-900">1. Acceptance of Terms</h2>
          <p>
            By accessing and using {verticalConfig.name} (&quot;the Site&quot;), operated by Smart
            Website Management (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), you agree to be
            bound by these Terms of Service. If you do not agree, please do not use the Site.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">2. Description of Service</h2>
          <p>
            {verticalConfig.name} is an online directory that connects users with lawyers in
            Ontario. We also provide an AI-powered triage tool that offers general legal
            information to help users identify the type of lawyer they may need.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">3. Not Legal Advice</h2>
          <p>
            The information provided on this Site, including responses from our AI assistant, is
            for general informational purposes only. It does not constitute legal advice and does
            not create a lawyer-client relationship. You should always consult a qualified lawyer
            for advice regarding your specific legal situation.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">4. User Conduct</h2>
          <p>
            You agree not to misuse the Site, including but not limited to: submitting false
            information, attempting to gain unauthorized access, or using the Site for any
            unlawful purpose.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">5. Listings and Claims</h2>
          <p>
            Lawyers listed on the Site may claim and manage their listings. We do not guarantee
            the accuracy, completeness, or quality of any listing. Users should independently
            verify lawyer credentials and qualifications.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">6. Payments and Subscriptions</h2>
          <p>
            Paid plans are billed monthly via Stripe. You may cancel your subscription at any
            time through your owner dashboard. Refunds are handled on a case-by-case basis.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">7. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, Smart Website Management shall not be liable
            for any indirect, incidental, special, or consequential damages arising from your use
            of the Site.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">8. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. Continued use of the Site
            after changes constitutes acceptance of the updated Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">9. Contact</h2>
          <p>
            For questions about these Terms, contact us at{" "}
            <a href={`mailto:${verticalConfig.supportEmail}`} className="underline" style={{ color: verticalConfig.primaryColor }}>
              {verticalConfig.supportEmail}
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
