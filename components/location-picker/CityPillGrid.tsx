import Link from "next/link";

export interface CityPill {
  name: string;
  slug: string;
  regionSlug: string;
  count: number;
}

interface Props {
  cities: CityPill[];
}

export default function CityPillGrid({ cities }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {cities.map((city) => (
        <Link
          key={`${city.regionSlug}/${city.slug}`}
          href={`/${city.regionSlug}/${city.slug}`}
          className="px-3 py-1.5 bg-gray-100 hover:bg-[#1E3A5F] hover:text-white rounded-full text-sm text-gray-700 transition-colors"
        >
          {city.name}
          {city.count > 0 && (
            <span className="ml-1 text-xs text-gray-400">({city.count})</span>
          )}
        </Link>
      ))}
    </div>
  );
}
