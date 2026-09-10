import type { Metadata } from "next";
import Link from "next/link";
import {
  allDataSources,
  dataSourcesRepo,
  precautionaryCredits,
  requiredAttributions,
} from "@/lib/data-sources";
import verticalConfig from "@/lib/vertical.config";

export const metadata: Metadata = {
  title: "Data sources & credits",
  description:
    "Where the listing data in this directory comes from, and the licence each source is used under.",
};

export default function DataCreditsPage() {
  const sources = allDataSources();
  // Deduped for the summary blocks; the per-source list below still shows every tag.
  const required = requiredAttributions();
  const precautionary = precautionaryCredits();

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Data sources &amp; credits</h1>
      <p className="text-gray-600 mb-8">
        Listings in {verticalConfig.name} are compiled from the sources below. Each is named with
        the dataset it came from, the licence it is used under, and the credit that licence
        requires. Where a licence makes attribution a condition of use, that credit is reproduced
        here word for word.
      </p>

      {required.length > 0 && (
        <div className="mb-10 rounded border border-gray-200 bg-gray-50 p-4">
          <h2 className="font-semibold mb-2">Required attributions</h2>
          <ul className="space-y-1 text-sm">
            {required.map((s) => (
              <li key={`req-${s.source_tag}`}>
                {s.licence_url ? (
                  <a
                    href={s.licence_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {s.attribution_line}
                  </a>
                ) : (
                  s.attribution_line
                )}
                <span className="text-gray-500"> — {s.licence}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {precautionary.length > 0 && (
        <div className="mb-10 rounded border border-gray-200 p-4">
          <h2 className="font-semibold mb-2">Credited as a precaution</h2>
          <p className="text-sm text-gray-600 mb-3">
            For these sources we could not read and quote a licence — the page states none, or it
            refused our request. A blocked read is not proof that no credit is owed, so we credit
            them anyway and record the verbatim wording as still outstanding.
          </p>
          <ul className="space-y-2 text-sm">
            {precautionary.map((s) => (
              <li key={`pre-${s.source_tag}`}>
                {s.credit_line}
                {s.extra_clause && (
                  <span className="block text-gray-600 mt-1">
                    {s.extra_clause}
                    {s.extra_clause_verbatim === false && (
                      <span className="text-gray-400">
                        {" "}
                        (our wording — the source&apos;s own text could not be retrieved)
                      </span>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="space-y-8">
        {sources.map((s) => (
          <li key={s.source_tag} className="border-l-2 border-gray-200 pl-4">
            <h2 className="font-semibold">
              {s.source_url && s.source_url.startsWith("http") ? (
                <a
                  href={s.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {s.authority}
                </a>
              ) : s.source_url ? (
                <Link href={s.source_url} className="underline">
                  {s.authority}
                </Link>
              ) : (
                s.authority
              )}
            </h2>
            <p className="text-sm text-gray-700 mt-1">{s.dataset}</p>
            <dl className="mt-2 text-sm text-gray-600 space-y-1">
              <div>
                <dt className="inline font-medium">Licence: </dt>
                <dd className="inline">
                  {s.licence_url && s.licence_url.startsWith("http") ? (
                    <a
                      href={s.licence_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      {s.licence}
                    </a>
                  ) : (
                    s.licence
                  )}
                </dd>
              </div>
              {s.attribution_required && s.attribution_line && (
                <div>
                  <dt className="inline font-medium">Required credit: </dt>
                  <dd className="inline">
                    <q>{s.attribution_line}</q>
                  </dd>
                </div>
              )}
              {s.credit_line && (
                <div>
                  <dt className="inline font-medium">Credited as: </dt>
                  <dd className="inline">{s.credit_line}</dd>
                </div>
              )}
              {s.plain_credit && (
                <div>
                  <dt className="inline font-medium">Credited as (provenance not recorded): </dt>
                  <dd className="inline">{s.plain_credit}</dd>
                </div>
              )}
              {s.last_seeded && (
                <div>
                  <dt className="inline font-medium">Last updated from source: </dt>
                  <dd className="inline">{s.last_seeded}</dd>
                </div>
              )}
            </dl>
            {s.note && <p className="text-xs text-gray-500 mt-2">{s.note}</p>}
          </li>
        ))}
      </ul>

      <p className="text-xs text-gray-500 mt-10">
        Source manifest: <code>data-sources.json</code> in {dataSourcesRepo}. Spotted something
        wrong? <Link href="/claim" className="underline">Tell us</Link>.
      </p>
    </main>
  );
}
