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
      <p className="text-sm text-gray-500 mb-8">Last updated: March 24, 2026</p>

      <div className="prose max-w-none space-y-6 text-gray-700">
        <section>
          <h2 className="text-xl font-semibold text-gray-900">1. Introduction</h2>
          <p>
            Smart Website Management (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates{" "}
            {verticalConfig.name} (&quot;the Site&quot;). This Privacy Policy explains how we
            collect, use, and protect your personal information.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">2. Information We Collect</h2>
          <p>We may collect the following types of information:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Contact information (name, email, phone) submitted via forms</li>
            <li>Chat messages submitted to our AI triage assistant</li>
            <li>Listing information provided by lawyers claiming their profiles</li>
            <li>Payment information processed securely through Stripe</li>
            <li>Usage data such as pages visited and interactions with the Site</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">3. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Provide and improve our directory and triage services</li>
            <li>Connect users with appropriate lawyers</li>
            <li>Process payments and manage subscriptions</li>
            <li>Send notifications related to inquiries and listings</li>
            <li>Communicate about service updates</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">4. Data Sharing</h2>
          <p>
            We do not sell your personal information. We may share data with third-party service
            providers (Supabase, Stripe, email services) solely to operate the Site. Inquiry
            messages are forwarded to the relevant lawyer listing.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">5. AI Chat Data</h2>
          <p>
            Conversations with our AI triage assistant are processed to provide guidance and may
            be stored to improve our service. Do not share sensitive personal information such as
            Social Insurance Numbers or financial account details in the chat.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">6. Cookies</h2>
          <p>
            We use cookies for authentication and session management. These are essential for the
            Site to function and cannot be disabled.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">7. Data Security</h2>
          <p>
            We implement reasonable security measures to protect your information. However, no
            method of transmission over the Internet is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">8. Your Rights</h2>
          <p>
            You may request access to, correction of, or deletion of your personal information by
            contacting us. Lawyers may update their listing information through the owner
            dashboard.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">9. Contact</h2>
          <p>
            For privacy-related questions, contact us at{" "}
            <a href={`mailto:${verticalConfig.supportEmail}`} className="underline" style={{ color: verticalConfig.primaryColor }}>
              {verticalConfig.supportEmail}
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
