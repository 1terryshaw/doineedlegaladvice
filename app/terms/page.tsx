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
      <p className="text-sm text-gray-500 mb-8">Last updated: May 13, 2026</p>

      <div className="prose max-w-none space-y-6 text-gray-700">
        <section>
          <h2 className="text-xl font-semibold text-gray-900">1. Acceptance of Terms</h2>
          <p>
            By accessing or using {verticalConfig.name} (&quot;the Site&quot;), operated by
            Smart Website Management (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), you
            agree to be bound by these Terms of Service. If you do not agree, do not use the
            Site.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">2. Not Legal Advice; No Attorney-Client Relationship</h2>
          <p>
            All content on the Site &mdash; including listings, AI-assistant responses,
            articles, and any other materials &mdash; is provided for general informational
            purposes only. It is <strong>not</strong> legal advice. <strong>No attorney-client
            relationship is formed</strong> by accessing the Site, submitting a triage chat,
            contacting a listed attorney through the Site, or otherwise using the Site.
            Information sent to or received from the Site is not confidential and is not
            protected by the attorney-client privilege or work-product doctrine. You should
            always consult an attorney licensed in your jurisdiction before acting on any
            information you obtain through the Site.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">3. Directory; No Endorsement</h2>
          <p>
            Listings are aggregated from publicly available sources and from claims submitted
            by listed parties. We do not vet, endorse, recommend, certify, or guarantee the
            qualifications, competence, fitness, licensure, disciplinary history, fee
            structure, or quality of any attorney, law firm, organization, or service listed.
            The Site does not function as a lawyer referral service. You are solely responsible
            for independently verifying the credentials and licensure of any attorney before
            engaging them.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">4. User Conduct</h2>
          <p>
            You agree not to misuse the Site, including by: submitting false or misleading
            information; impersonating any person or entity; attempting to gain unauthorized
            access; scraping or harvesting data; interfering with the Site&apos;s operation; or
            using the Site for any unlawful purpose. We may suspend or terminate access at any
            time, with or without notice, for any reason.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">5. Listings and Claims</h2>
          <p>
            Attorneys and organizations may claim and manage their listings subject to our
            verification process. Claiming a listing does not establish any relationship with
            us other than as set out in these Terms. We may modify, suspend, or remove any
            listing at any time.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">6. Payments and Subscriptions</h2>
          <p>
            Paid plans are billed in U.S. dollars on a recurring basis through Stripe. You may
            cancel at any time through your owner dashboard; cancellation takes effect at the
            end of the current billing period. Fees already paid are non-refundable except
            where required by applicable law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">7. Disclaimer of Warranties</h2>
          <p>
            THE SITE AND ALL CONTENT ARE PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS
            AVAILABLE&quot; BASIS, WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
            INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
            PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY, OR AVAILABILITY. WE DO NOT WARRANT
            THAT THE SITE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER
            HARMFUL COMPONENTS.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">8. Limitation of Liability</h2>
          <p>
            TO THE FULLEST EXTENT PERMITTED BY LAW, IN NO EVENT WILL SMART WEBSITE MANAGEMENT,
            ITS AFFILIATES, OR ITS OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY
            INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR
            FOR ANY LOSS OF PROFITS, REVENUE, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES,
            ARISING OUT OF OR RELATED TO YOUR USE OF (OR INABILITY TO USE) THE SITE, EVEN IF
            ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL CUMULATIVE LIABILITY FOR ANY
            CLAIM ARISING OUT OF OR RELATED TO THE SITE WILL NOT EXCEED THE GREATER OF
            (A) ONE HUNDRED U.S. DOLLARS ($100) OR (B) THE TOTAL AMOUNT YOU PAID US IN THE
            TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">9. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless Smart Website Management, its
            affiliates, and its officers, directors, employees, contractors, and agents
            (collectively, the &quot;Indemnified Parties&quot;) from and against any and all
            claims, demands, losses, liabilities, damages, judgments, settlements, costs, and
            expenses (including reasonable attorneys&apos; fees) arising out of or related to:
            (a) your use or misuse of the Site; (b) your violation of these Terms or any
            applicable law; (c) any content you submit; (d) your reliance on any information
            obtained through the Site, including any decision to retain or not retain an
            attorney; and (e) any dispute between you and any attorney or organization listed
            on the Site. We reserve the right, at our own expense, to assume the exclusive
            defense and control of any matter otherwise subject to indemnification by you, in
            which case you agree to cooperate.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">10. Binding Arbitration; Class-Action Waiver</h2>
          <p>
            <strong>Please read this section carefully &mdash; it affects your legal
            rights.</strong> Any dispute, claim, or controversy arising out of or relating to
            these Terms or the Site (a &quot;Dispute&quot;) shall be resolved exclusively by
            <strong> final and binding individual arbitration</strong> administered by the
            American Arbitration Association (AAA) under its Commercial Arbitration Rules,
            rather than in court, except that either party may bring an individual claim in
            small-claims court. The arbitration shall be conducted in English, on a
            documents-only basis where permitted, and the seat shall be Delaware, USA. The
            arbitrator&apos;s decision is final and may be entered as a judgment in any court
            of competent jurisdiction.
          </p>
          <p>
            <strong>YOU AND WE AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN
            YOUR OR ITS INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY
            PURPORTED CLASS OR REPRESENTATIVE PROCEEDING.</strong> The arbitrator may not
            consolidate more than one person&apos;s claims and may not otherwise preside over
            any form of representative or class proceeding. If this class-action waiver is
            found unenforceable, the entirety of this Arbitration section is null and void.
          </p>
          <p>
            <strong>30-Day Opt-Out:</strong> You may opt out of this arbitration agreement by
            sending written notice to {verticalConfig.supportEmail} within thirty (30) days of
            first accepting these Terms; the notice must include your full name and a
            statement that you wish to opt out. Opting out does not affect any other provision
            of these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">11. Governing Law; Venue</h2>
          <p>
            These Terms are governed by the laws of the State of Delaware, USA, without regard
            to conflict-of-laws principles. Subject to Section 10, the state and federal courts
            located in Delaware shall have exclusive jurisdiction over any dispute not subject
            to arbitration.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">12. Changes to Terms</h2>
          <p>
            We may modify these Terms at any time by posting an updated version. Material
            changes will be indicated by updating the &quot;Last updated&quot; date. Your
            continued use of the Site after the effective date constitutes acceptance of the
            updated Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">13. Severability</h2>
          <p>
            If any provision of these Terms is held invalid or unenforceable, the remaining
            provisions will continue in full force and effect.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900">14. Contact</h2>
          <p>
            Questions about these Terms?{" "}
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
