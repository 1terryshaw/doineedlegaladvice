import { Metadata } from "next";
import verticalConfig from "@/lib/vertical.config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy Policy for ${verticalConfig.name}`,
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: May 13, 2026</p>

      <div className="prose max-w-none space-y-6 text-gray-700">
        <section>
          <h2 className="text-xl font-semibold text-gray-900">1. Introduction</h2>
          <p>
            Smart Website Management (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates{" "}
            {verticalConfig.name} (&quot;the Site&quot;). This Privacy Policy explains how we
            collect, use, and protect information you submit through the Site.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">2. Information We Collect</h2>
          <p>We may collect:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Contact information (name, email, phone) submitted via forms</li>
            <li>Messages submitted to our AI assistant or contact pages</li>
            <li>Listing information provided by attorneys or organizations claiming profiles</li>
            <li>Payment information processed securely through Stripe</li>
            <li>Usage data such as pages visited and interactions with the Site</li>
            <li>IP addresses and basic device information for security and analytics</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">3. How We Use Information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To operate and improve the directory and AI features</li>
            <li>To route inquiries to relevant attorneys or organizations</li>
            <li>To process payments and manage subscriptions</li>
            <li>To send transactional emails (claim verification, inquiry forwards, billing)</li>
            <li>To detect and prevent abuse</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">4. AI Chat &mdash; Important</h2>
          <p>
            Conversations with our AI assistant are processed by Anthropic&apos;s Claude API and
            may be stored to improve our service. <strong>Do not share Social Security Numbers,
            financial account credentials, or any information you consider privileged.</strong>
            Communications with our AI are <strong>not</strong> attorney-client privileged. See
            our <a href="/terms" className="underline">Terms</a> for details.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">5. Data Sharing</h2>
          <p>
            We do not sell your personal information. We share data only with service providers
            necessary to operate the Site (Supabase for storage, Stripe for billing, email
            providers, Anthropic for AI). Inquiry messages you submit are forwarded to the
            relevant listing.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">6. Cookies</h2>
          <p>
            We use cookies strictly for authentication and session management. These cookies
            are essential to the operation of the Site and cannot be disabled.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">7. Children</h2>
          <p>
            The Site is not directed to children under 13. We do not knowingly collect personal
            information from children under 13.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">8. Your Rights (California &amp; Other Jurisdictions)</h2>
          <p>
            If you are a California resident, you have rights under the California Consumer
            Privacy Act (CCPA) including the right to know what personal information we
            collect, the right to delete, and the right to opt out of sale (we do not sell).
            Residents of other states with applicable privacy laws have analogous rights. To
            exercise any right, email us at{" "}
            <a
              href={`mailto:${verticalConfig.supportEmail}`}
              className="underline"
              style={{ color: verticalConfig.primaryColor }}
            >
              {verticalConfig.supportEmail}
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">9. Data Security</h2>
          <p>
            We use commercially reasonable technical and organizational measures to protect
            information. No method of internet transmission is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">10. Changes</h2>
          <p>
            We may update this Privacy Policy from time to time. Material changes will be
            reflected in the &quot;Last updated&quot; date above.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">11. Contact</h2>
          <p>
            Privacy questions?{" "}
            <a
              href={`mailto:${verticalConfig.supportEmail}`}
              className="underline"
              style={{ color: verticalConfig.primaryColor }}
            >
              {verticalConfig.supportEmail}
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
