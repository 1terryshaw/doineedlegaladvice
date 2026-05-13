import {
  CANONICAL_CITIES,
  PROVINCE_MAP,
  getCityBySlug as _getCityBySlug,
} from "./shared/cities";
import verticalConfig from "./vertical.config";

// US states (50 + DC). slug = lowercase 2-letter code, used at /[region].
// CITIES below still uses the CA canonical catalog until a US city harvest
// lands; /[region]/[city] will resolve CA city slugs only for now.
export const REGIONS = [
  { name: "Alabama", slug: "al", province: "AL" },
  { name: "Alaska", slug: "ak", province: "AK" },
  { name: "Arizona", slug: "az", province: "AZ" },
  { name: "Arkansas", slug: "ar", province: "AR" },
  { name: "California", slug: "ca", province: "CA" },
  { name: "Colorado", slug: "co", province: "CO" },
  { name: "Connecticut", slug: "ct", province: "CT" },
  { name: "Delaware", slug: "de", province: "DE" },
  { name: "Florida", slug: "fl", province: "FL" },
  { name: "Georgia", slug: "ga", province: "GA" },
  { name: "Hawaii", slug: "hi", province: "HI" },
  { name: "Idaho", slug: "id", province: "ID" },
  { name: "Illinois", slug: "il", province: "IL" },
  { name: "Indiana", slug: "in", province: "IN" },
  { name: "Iowa", slug: "ia", province: "IA" },
  { name: "Kansas", slug: "ks", province: "KS" },
  { name: "Kentucky", slug: "ky", province: "KY" },
  { name: "Louisiana", slug: "la", province: "LA" },
  { name: "Maine", slug: "me", province: "ME" },
  { name: "Maryland", slug: "md", province: "MD" },
  { name: "Massachusetts", slug: "ma", province: "MA" },
  { name: "Michigan", slug: "mi", province: "MI" },
  { name: "Minnesota", slug: "mn", province: "MN" },
  { name: "Mississippi", slug: "ms", province: "MS" },
  { name: "Missouri", slug: "mo", province: "MO" },
  { name: "Montana", slug: "mt", province: "MT" },
  { name: "Nebraska", slug: "ne", province: "NE" },
  { name: "Nevada", slug: "nv", province: "NV" },
  { name: "New Hampshire", slug: "nh", province: "NH" },
  { name: "New Jersey", slug: "nj", province: "NJ" },
  { name: "New Mexico", slug: "nm", province: "NM" },
  { name: "New York", slug: "ny", province: "NY" },
  { name: "North Carolina", slug: "nc", province: "NC" },
  { name: "North Dakota", slug: "nd", province: "ND" },
  { name: "Ohio", slug: "oh", province: "OH" },
  { name: "Oklahoma", slug: "ok", province: "OK" },
  { name: "Oregon", slug: "or", province: "OR" },
  { name: "Pennsylvania", slug: "pa", province: "PA" },
  { name: "Rhode Island", slug: "ri", province: "RI" },
  { name: "South Carolina", slug: "sc", province: "SC" },
  { name: "South Dakota", slug: "sd", province: "SD" },
  { name: "Tennessee", slug: "tn", province: "TN" },
  { name: "Texas", slug: "tx", province: "TX" },
  { name: "Utah", slug: "ut", province: "UT" },
  { name: "Vermont", slug: "vt", province: "VT" },
  { name: "Virginia", slug: "va", province: "VA" },
  { name: "Washington", slug: "wa", province: "WA" },
  { name: "West Virginia", slug: "wv", province: "WV" },
  { name: "Wisconsin", slug: "wi", province: "WI" },
  { name: "Wyoming", slug: "wy", province: "WY" },
  { name: "District of Columbia", slug: "dc", province: "DC" },
];

export const CITIES = CANONICAL_CITIES.map((c) => ({
  name: c.name,
  slug: c.slug,
  province: c.province,
}));

export const LISTING_TYPES = [
  { name: "Family Lawyer", slug: "family-lawyer", description: "Divorce, custody, child support" },
  { name: "Immigration Lawyer", slug: "immigration-lawyer", description: "Green card, citizenship, asylum, deportation defense" },
  { name: "Criminal Defense Lawyer", slug: "criminal-lawyer", description: "DUI, felony, misdemeanor defense" },
  { name: "Personal Injury Lawyer", slug: "personal-injury-lawyer", description: "Auto accidents, slip and fall, medical malpractice" },
  { name: "Estate Planning Lawyer", slug: "estate-lawyer", description: "Wills, trusts, probate" },
  { name: "Real Estate Lawyer", slug: "real-estate-lawyer", description: "Closings, title disputes, property transactions" },
  { name: "Business Lawyer", slug: "business-lawyer", description: "Formation, contracts, commercial disputes" },
  { name: "Employment Lawyer", slug: "employment-lawyer", description: "Wrongful termination, discrimination, wage disputes" },
  { name: "Bankruptcy Lawyer", slug: "bankruptcy-lawyer", description: "Chapter 7, Chapter 13, debt relief" },
  { name: "Tax Lawyer", slug: "tax-lawyer", description: "IRS disputes, tax court, planning" },
];

export const BRAND = {
  siteName: verticalConfig.name,
  siteUrl: `https://${verticalConfig.domain}`,
  supportEmail: verticalConfig.supportEmail,
};

export function getRegionBySlug(slug: string) {
  return REGIONS.find((r) => r.slug === slug.toLowerCase()) || null;
}

export function getListingTypeBySlug(slug: string) {
  return LISTING_TYPES.find((t) => t.slug === slug) || null;
}

export function getCityBySlug(provinceSlug: string, citySlug: string) {
  const province = provinceSlug.toUpperCase();
  return CITIES.find((c: any) => c.province === province && c.slug === citySlug) || null;
}

export const PROVINCES: Record<string, string> = PROVINCE_MAP;
