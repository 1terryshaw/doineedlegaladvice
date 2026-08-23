/**
 * OGL v3.0 attribution for Companies House data. REQUIRED — NOT DECORATIVE.
 *
 * The /uk subtree is fed by Companies House SIC extracts, filed REDISTRIBUTABLE in
 * empire-legal-audit/verdicts.json on 2026-08-23 under the Open Government Licence v3.0.
 * That licence is CONDITIONAL. Its own words:
 *
 *   "You must (where you do any of the above): acknowledge the source of the Information
 *    in your product or application by including or linking to any attribution statement
 *    specified by the Information Provider(s) and, where possible, provide a link to this
 *    licence ... These are important conditions of this licence and if you fail to comply
 *    with them the rights granted to you under this licence ... will end AUTOMATICALLY."
 *
 * Companies House specifies no attribution statement of its own (checked 2026-08-23 across
 * the CH bulk-data, developer-specs, service-information and GOV.UK organisation pages), so
 * the OGL default applies and is reproduced here VERBATIM:
 *
 *   "Contains public sector information licensed under the Open Government Licence v3.0."
 *
 * Do not paraphrase, shorten, or split that sentence. The licence name is hyperlinked inside
 * it, which is the form GOV.UK itself uses and which satisfies "provide a link to this licence".
 *
 * 🔴 THIS MUST SURVIVE THE NOINDEX LIFT. It is rendered from app/uk/layout.tsx, which is also
 * where the /uk noindex lives. Step 2 of the K32 reversal order edits that file. Removing the
 * attribution at the moment the pages become indexable would breach the licence exactly when
 * publication compliance starts to matter. Change the robots metadata; leave this rendered.
 */
export default function UkAttribution() {
  return (
    <aside
      aria-label="Data attribution"
      className="mx-auto mt-8 max-w-6xl border-t border-gray-200 px-4 py-6 text-xs leading-relaxed text-gray-500"
    >
      <p>
        UK company registration data shown on this page is sourced from{" "}
        <a
          href="https://www.gov.uk/government/organisations/companies-house"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-700"
        >
          Companies House
        </a>
        . Contains public sector information licensed under the{" "}
        <a
          href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
          target="_blank"
          rel="license noopener noreferrer"
          className="underline hover:text-gray-700"
        >
          Open Government Licence v3.0
        </a>
        .
      </p>
    </aside>
  );
}
