// CityFacetSummary — renders the data-derived facet summary on a city page, both as
// human-visible prose AND as flat ItemList structured data (facet VALUES, not
// per-listing — honoring lib/seo.ts's "no nested per-listing ItemList" stance).
// Renders NOTHING when facets is null (de-serve floor not met in lib/facets.ts).
import { CityFacets } from "@/lib/facets";

interface Props {
  facets: CityFacets | null;
  cityName: string;
  noun: string; // e.g. "lawyers"
}

export default function CityFacetSummary({ facets, cityName, noun }: Props) {
  if (!facets) return null;
  const top = facets.services.slice(0, 8);

  const facts = top.map((t) => `${t.count} offer ${t.term}`);
  const ratingClause = facets.avgRating
    ? ` ${facets.ratedCount} are rated (avg ${facets.avgRating.toFixed(1)}★).`
    : "";

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Services offered by ${noun} in ${cityName}`,
    numberOfItems: top.length,
    itemListElement: top.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.term,
    })),
  };

  return (
    <section className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-5" aria-label={`Summary of ${noun} in ${cityName}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />
      <p className="text-gray-800">
        <span className="font-semibold">
          {facets.enrichedCount} of {facets.totalCount} {noun} in {cityName} have detailed profiles.
        </span>{" "}
        {facts.slice(0, -1).join(", ")}
        {facts.length > 1 ? ", and " : ""}
        {facts[facts.length - 1]}.{ratingClause}
      </p>
    </section>
  );
}
