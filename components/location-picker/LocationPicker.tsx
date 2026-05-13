import { headers } from "next/headers";
import { COUNTRIES, getCountryFromLocale, type CountryCode } from "./countries";
import { getNearbyCities, type CityWithCoords } from "./haversine";
import { CITY_COORDINATES } from "./city-coordinates";
import NearYouRow from "./NearYouRow";
import CountryAccordion, { type StateData } from "./CountryAccordion";

interface Props {
  /** e.g. "plumber_" — used to derive table name */
  tablePrefix: string;
  /** Province/state definitions with country mapping */
  provinces: Array<{ code: string; name: string; country: string }>;
  /** Canonical cities list */
  cities: Array<{ name: string; slug: string; province: string; listing_count?: number }>;
}

export default async function LocationPicker({ tablePrefix, provinces, cities }: Props) {
  const headersList = await headers();

  // Read Vercel's automatic geo headers (no middleware needed)
  const visitorCountry = headersList.get("x-vercel-ip-country") || null;
  const visitorRegion = headersList.get("x-vercel-ip-country-region") || null;
  const visitorLat = parseFloat(headersList.get("x-vercel-ip-latitude") || "");
  const visitorLng = parseFloat(headersList.get("x-vercel-ip-longitude") || "");
  const acceptLanguage = headersList.get("accept-language") || "";

  // Determine which country to auto-expand
  let expandCountry: string | null = visitorCountry;
  if (!expandCountry) {
    // Fallback: browser locale hint
    const primaryLocale = acceptLanguage.split(",")[0]?.trim() || "";
    const fromLocale = getCountryFromLocale(primaryLocale);
    if (fromLocale) expandCountry = fromLocale;
  }

  // Build province code → info map
  const provinceByCode = new Map(provinces.map((p) => [p.code, p]));

  // Build province code → slug map (provinces use their code as URL slug)
  const regionSlugMap: Record<string, string> = {};
  for (const p of provinces) {
    regionSlugMap[p.code] = p.code;
  }

  // Build country → state → city hierarchy from canonical data
  const countryToStates = new Map<string, Map<string, StateData>>();

  for (const city of cities) {
    const prov = provinceByCode.get(city.province);
    if (!prov) continue;

    const countryCode = prov.country;
    if (!countryToStates.has(countryCode)) {
      countryToStates.set(countryCode, new Map());
    }
    const statesMap = countryToStates.get(countryCode)!;

    if (!statesMap.has(prov.code)) {
      statesMap.set(prov.code, {
        code: prov.code,
        name: prov.name,
        cities: [],
      });
    }

    statesMap.get(prov.code)!.cities.push({
      name: city.name,
      slug: city.slug,
      regionSlug: prov.code,
      count: city.listing_count || 0,
    });
  }

  // Sort countries alphabetically, states alphabetically within each
  const sortedCountries: Array<{
    code: string;
    name: string;
    flag: string;
    states: StateData[];
  }> = [];

  Array.from(countryToStates.entries()).forEach(([code, statesMap]) => {
    const countryInfo = COUNTRIES[code as CountryCode];
    if (!countryInfo) return;

    const states = Array.from(statesMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    for (const state of states) {
      state.cities.sort((a, b) => a.name.localeCompare(b.name));
    }

    sortedCountries.push({
      code,
      name: countryInfo.name,
      flag: countryInfo.flag,
      states,
    });
  });
  sortedCountries.sort((a, b) => a.name.localeCompare(b.name));

  // Build "Near you" data using canonical city coordinates
  let nearbyCities: ReturnType<typeof getNearbyCities> = [];
  if (!isNaN(visitorLat) && !isNaN(visitorLng)) {
    const citiesWithCoords: CityWithCoords[] = cities
      .map((c) => {
        const coords = CITY_COORDINATES[`${c.province}:${c.slug}`];
        if (!coords) return null;
        return { ...c, lat: coords.lat, lng: coords.lng };
      })
      .filter((c): c is CityWithCoords => c !== null);

    const nearby = getNearbyCities({ lat: visitorLat, lng: visitorLng }, citiesWithCoords, 50, 10);

    // Sort by listing count (tiebreaker: distance), take top 3
    nearbyCities = nearby
      .sort((a, b) => {
        const countA = cities.find((x) => x.province === a.province && x.slug === a.slug)?.listing_count || 0;
        const countB = cities.find((x) => x.province === b.province && x.slug === b.slug)?.listing_count || 0;
        if (countB !== countA) return countB - countA;
        return a.distance - b.distance;
      })
      .slice(0, 3);
  }

  return (
    <div className="space-y-4" data-testid="location-picker">
      <NearYouRow cities={nearbyCities} regionSlugMap={regionSlugMap} />
      {sortedCountries.map((country) => (
        <CountryAccordion
          key={country.code}
          countryCode={country.code}
          countryName={country.name}
          flag={country.flag}
          states={country.states}
          defaultExpanded={expandCountry === country.code}
          visitorRegion={visitorRegion}
        />
      ))}
    </div>
  );
}
