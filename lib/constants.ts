import {
  CANONICAL_CITIES,
  PROVINCE_MAP,
  getCityBySlug as _getCityBySlug,
} from "./shared/cities";

// Ontario regions
export const REGIONS = [
  { name: "Toronto", slug: "toronto", province: "ON" },
  { name: "Ottawa", slug: "ottawa", province: "ON" },
  { name: "Mississauga", slug: "mississauga", province: "ON" },
  { name: "Hamilton", slug: "hamilton", province: "ON" },
  { name: "London", slug: "london", province: "ON" },
  { name: "Brampton", slug: "brampton", province: "ON" },
  { name: "Kitchener", slug: "kitchener", province: "ON" },
  { name: "Windsor", slug: "windsor", province: "ON" },
  { name: "Oshawa", slug: "oshawa", province: "ON" },
  { name: "Barrie", slug: "barrie", province: "ON" },
  { name: "Kingston", slug: "kingston", province: "ON" },
  { name: "Guelph", slug: "guelph", province: "ON" },
  { name: "Thunder Bay", slug: "thunder-bay", province: "ON" },
  { name: "Sudbury", slug: "sudbury", province: "ON" },
  { name: "Burlington", slug: "burlington", province: "ON" },
  { name: "Oakville", slug: "oakville", province: "ON" },
  { name: "Markham", slug: "markham", province: "ON" },
  { name: "Vaughan", slug: "vaughan", province: "ON" },
  { name: "Richmond Hill", slug: "richmond-hill", province: "ON" },
  { name: "Whitby", slug: "whitby", province: "ON" },
  { name: "Newmarket", slug: "newmarket", province: "ON" },
  { name: "Cambridge", slug: "cambridge", province: "ON" },
  { name: "Waterloo", slug: "waterloo", province: "ON" },
  { name: "Brantford", slug: "brantford", province: "ON" },
  { name: "St. Catharines", slug: "st-catharines", province: "ON" },
];
// Cities sourced from canonical shared list
export const CITIES = CANONICAL_CITIES.map((c) => ({
  name: c.name,
  slug: c.slug,
  province: c.province,
}));



// Lawyer practice areas
export const LISTING_TYPES = [
  { name: "Family Lawyer", slug: "family-lawyer", description: "Divorce, custody, child support" },
  { name: "Real Estate Lawyer", slug: "real-estate-lawyer", description: "Property transactions, closings, disputes" },
  { name: "Immigration Lawyer", slug: "immigration-lawyer", description: "Visas, citizenship, refugee claims" },
  { name: "Criminal Lawyer", slug: "criminal-lawyer", description: "Criminal defence, DUI, assault charges" },
  { name: "Personal Injury Lawyer", slug: "personal-injury-lawyer", description: "Accidents, slip and fall, medical malpractice" },
  { name: "Business Lawyer", slug: "business-lawyer", description: "Incorporations, contracts, commercial disputes" },
  { name: "Employment Lawyer", slug: "employment-lawyer", description: "Wrongful dismissal, workplace disputes" },
  { name: "Estate Lawyer", slug: "estate-lawyer", description: "Wills, probate, estate planning" },
  { name: "Tax Lawyer", slug: "tax-lawyer", description: "Tax disputes, CRA audits, tax planning" },
  { name: "Intellectual Property Lawyer", slug: "intellectual-property-lawyer", description: "Patents, trademarks, copyright" },
];

export const BRAND = {
  siteName: "FreeLawyerAdvice.ca",
  siteUrl: "https://freelawyeradvice.ca",
  supportEmail: "hello@freelawyeradvice.ca",
};

export function getRegionBySlug(slug: string) {
  return REGIONS.find((r) => r.slug === slug) || null;
}

export function getListingTypeBySlug(slug: string) {
  return LISTING_TYPES.find((t) => t.slug === slug) || null;
}

export function getCityBySlug(provinceSlug: string, citySlug: string) {
  const province = provinceSlug.toUpperCase();
  return CITIES.find((c: any) => c.province === province && c.slug === citySlug) || null;
}

export const PROVINCES: Record<string, string> = PROVINCE_MAP;
