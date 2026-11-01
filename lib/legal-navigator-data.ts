// legal-navigator-data.ts — TDL #1402 (legal-liability-containment-and-consolidation-v1)
// STAMPED, byte-identical in freelawyeradvice + doineedlegaladvice.
// Source of truth: ~/empire/legal-liability-containment-v1/stamp/lib/legal-navigator-data.ts
//
// DETERMINISTIC legal-help navigator data. This replaces the generative legal chat,
// which was observed (2026-11-01, [TEST] transcripts in the mission evidence dir) giving
// individualized advice, outcome predictions and limitation-deadline determinations.
//
// Doctrine (K-doc "legal-help navigator"): NO generative legal chat without counsel
// clearance. This module holds only static navigation facts: which TYPE of licensed
// professional handles a category of problem, and official public resources.
// It never says what a person should do about their matter, never states a deadline,
// and never predicts an outcome.
//
// Every URL below was link-checked on 2026-11-01 (evidence/urlcheck*.txt). Bodies whose
// site could not be reached from the check are listed by NAME ONLY (no url) — a wrong or
// dead link to a legal-aid office is worse than none.

export type Country = "CA" | "US";

export interface Resource {
  name: string;
  url?: string; // omitted ⇒ name-only (look up current contact details)
  note?: string;
}

export interface Jurisdiction {
  code: string; // ISO-ish region code, upper-case (ON, BC, … / NY, TX, …)
  name: string;
  country: Country;
}

export const CA_PROVINCES: Jurisdiction[] = [
  { code: "AB", name: "Alberta", country: "CA" },
  { code: "BC", name: "British Columbia", country: "CA" },
  { code: "MB", name: "Manitoba", country: "CA" },
  { code: "NB", name: "New Brunswick", country: "CA" },
  { code: "NL", name: "Newfoundland and Labrador", country: "CA" },
  { code: "NS", name: "Nova Scotia", country: "CA" },
  { code: "NT", name: "Northwest Territories", country: "CA" },
  { code: "NU", name: "Nunavut", country: "CA" },
  { code: "ON", name: "Ontario", country: "CA" },
  { code: "PE", name: "Prince Edward Island", country: "CA" },
  { code: "QC", name: "Québec", country: "CA" },
  { code: "SK", name: "Saskatchewan", country: "CA" },
  { code: "YT", name: "Yukon", country: "CA" },
];

export const US_STATES: Jurisdiction[] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
].map(([code, name]) => ({ code, name, country: "US" as const }));

export type CategoryId =
  | "family" | "employment" | "housing" | "criminal" | "immigration"
  | "estates" | "real-estate" | "business" | "injury" | "other";

/** Order is the display order. "Other" is always last. */
export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: "family", label: "Family (separation, divorce, parenting, support)" },
  { id: "employment", label: "Employment (job loss, workplace issues)" },
  { id: "housing", label: "Housing (renting, landlord or tenant)" },
  { id: "criminal", label: "Criminal charges or police" },
  { id: "immigration", label: "Immigration or citizenship" },
  { id: "estates", label: "Wills and estates" },
  { id: "real-estate", label: "Buying or selling property" },
  { id: "business", label: "Business" },
  { id: "injury", label: "Injury or accident" },
  { id: "other", label: "Other / not sure" },
];

/** Which TYPE of licensed professional handles this category. Navigation, not advice. */
export function professionalFor(country: Country, region: string, cat: CategoryId): { title: string; notes: string[] } {
  const lawyer = country === "CA" ? "lawyer" : "attorney";
  const qc = country === "CA" && region === "QC";
  const on = country === "CA" && region === "ON";
  const notes: string[] = [];
  switch (cat) {
    case "family":
      return { title: `Family ${lawyer}`, notes };
    case "employment":
      if (on) notes.push("In Ontario, licensed paralegals can also provide some employment-related legal services.");
      notes.push(country === "CA"
        ? "Your province's employment standards office handles many workplace-standards complaints."
        : "Your state labor department and the U.S. Department of Labor handle many wage and workplace-standards complaints.");
      return { title: `Employment ${lawyer}`, notes };
    case "housing":
      if (on) notes.push("In Ontario, licensed paralegals can also represent people at the Landlord and Tenant Board.");
      notes.push(country === "CA"
        ? "Many residential tenancy disputes are heard by a provincial tribunal or board rather than a court."
        : "Many cities and states have tenant or housing help programs; legal aid organizations often handle housing matters.");
      return { title: `Landlord-tenant ${lawyer}`, notes };
    case "criminal":
      notes.push(country === "CA"
        ? "Legal aid may cover criminal matters if you qualify financially."
        : "If you are charged with a crime and cannot afford an attorney, you can ask the court about a public defender.");
      return { title: country === "CA" ? "Criminal defence lawyer" : "Criminal defense attorney", notes };
    case "immigration":
      notes.push(country === "CA"
        ? "Licensed immigration consultants (RCIC), regulated by the College of Immigration and Citizenship Consultants, may also provide immigration services."
        : "Only attorneys and DOJ-accredited representatives may give immigration legal advice. Be cautious of \"notarios\" and unlicensed consultants.");
      return { title: `Immigration ${lawyer}`, notes };
    case "estates":
      if (qc) notes.push("In Québec, notaries also prepare wills and handle estate matters.");
      return { title: `Wills and estates ${lawyer}`, notes };
    case "real-estate":
      if (qc) return { title: "Notary (notaire)", notes: ["In Québec, residential real estate transactions are handled by notaries."] };
      return { title: `Real estate ${lawyer}`, notes };
    case "business":
      return { title: `Business ${lawyer}`, notes };
    case "injury":
      return { title: `Personal injury ${lawyer}`, notes };
    case "other":
    default:
      notes.push(country === "CA"
        ? "Your law society's lawyer referral service or directory can point you to the right type of lawyer."
        : "Your state bar's lawyer referral service can point you to the right type of attorney.");
      return { title: `General practice ${lawyer}`, notes };
  }
}

interface ProvinceResources {
  referral: Resource; // law society referral service / lawyer directory
  legalAid: Resource;
  publicInfo?: Resource; // CLEO / Clicklaw / Éducaloi equivalent
}

export const CA_RESOURCES: Record<string, ProvinceResources> = {
  ON: {
    referral: { name: "Law Society of Ontario — Law Society Referral Service", url: "https://lso.ca/" },
    legalAid: { name: "Legal Aid Ontario", url: "https://www.legalaid.on.ca/" },
    publicInfo: { name: "Steps to Justice (by CLEO)", url: "https://stepstojustice.ca/" },
  },
  BC: {
    referral: { name: "Lawyer Referral Service (Access Pro Bono)", url: "https://www.accessprobono.ca/" },
    legalAid: { name: "Legal Aid BC", url: "https://legalaid.bc.ca/" },
    publicInfo: { name: "Clicklaw", url: "https://www.clicklaw.bc.ca/" },
  },
  QC: {
    referral: { name: "Barreau du Québec", url: "https://www.barreau.qc.ca/" },
    legalAid: { name: "Commission des services juridiques (aide juridique)", url: "https://www.csj.qc.ca/" },
    publicInfo: { name: "Éducaloi", url: "https://educaloi.qc.ca/" },
  },
  AB: {
    referral: { name: "Law Society of Alberta — Lawyer Referral", url: "https://www.lawsociety.ab.ca/" },
    legalAid: { name: "Legal Aid Alberta", url: "https://www.legalaid.ab.ca/" },
    publicInfo: { name: "Centre for Public Legal Education Alberta (CPLEA)", url: "https://www.cplea.ca/" },
  },
  SK: {
    referral: { name: "Law Society of Saskatchewan", url: "https://www.lawsociety.sk.ca/" },
    legalAid: { name: "Legal Aid Saskatchewan", url: "https://www.legalaid.sk.ca/" },
    publicInfo: { name: "Public Legal Education Association of Saskatchewan (PLEA)", url: "https://www.plea.org/" },
  },
  MB: {
    referral: { name: "Law Society of Manitoba", url: "https://lawsociety.mb.ca/" },
    legalAid: { name: "Legal Aid Manitoba", url: "https://www.legalaid.mb.ca/" },
    publicInfo: { name: "Community Legal Education Association", url: "https://www.communitylegal.mb.ca/" },
  },
  NS: {
    referral: { name: "Legal Information Society of Nova Scotia — Lawyer Referral Service", url: "https://www.legalinfo.org/" },
    legalAid: { name: "Nova Scotia Legal Aid", url: "https://www.nslegalaid.ca/" },
    publicInfo: { name: "Nova Scotia Barristers' Society", url: "https://nsbs.org/" },
  },
  NB: {
    referral: { name: "Law Society of New Brunswick", url: "https://lawsociety-barreau.nb.ca/" },
    legalAid: { name: "New Brunswick Legal Aid Services Commission" },
    publicInfo: { name: "Public Legal Education and Information Service of New Brunswick (PLEIS-NB)" },
  },
  PE: {
    referral: { name: "Law Society of Prince Edward Island", url: "https://lawsocietypei.ca/" },
    legalAid: { name: "PEI Legal Aid", url: "https://www.princeedwardisland.ca/en/information/justice-and-public-safety/legal-aid" },
    publicInfo: { name: "Community Legal Information (PEI)", url: "https://legalinfopei.ca/" },
  },
  NL: {
    referral: { name: "Law Society of Newfoundland and Labrador", url: "https://lsnl.ca/" },
    legalAid: { name: "Legal Aid Newfoundland and Labrador", url: "https://www.legalaid.nl.ca/" },
    publicInfo: { name: "Public Legal Information Association of NL (PLIAN)", url: "https://publiclegalinfo.com/" },
  },
  YT: {
    referral: { name: "Law Society of Yukon — Find a Lawyer", url: "https://lawsocietyyukon.com/find-a-lawyer/" },
    legalAid: { name: "Yukon Legal Services Society (Legal Aid)", url: "https://yukonlegalaid.ca/" },
  },
  NT: {
    referral: { name: "Law Society of the Northwest Territories", url: "https://lawsociety.nt.ca/" },
    legalAid: { name: "NWT Legal Aid", url: "https://www.justice.gov.nt.ca/en/legal-aid/" },
  },
  NU: {
    referral: { name: "Law Society of Nunavut", url: "https://lawsociety.nu.ca/" },
    legalAid: { name: "Legal Services Board of Nunavut" },
  },
};

/** National resources shown with every CA result where relevant. */
export const CA_NATIONAL: Partial<Record<CategoryId, Resource[]>> = {
  immigration: [
    { name: "Immigration, Refugees and Citizenship Canada (official)", url: "https://www.canada.ca/en/immigration-refugees-citizenship.html" },
    { name: "College of Immigration and Citizenship Consultants (check a consultant's licence)" },
  ],
};

export const US_RESOURCES: Resource[] = [
  { name: "Legal Services Corporation — find free civil legal aid", url: "https://www.lsc.gov/about-lsc/what-legal-aid/i-need-legal-help" },
  { name: "Your state bar association's lawyer referral service", note: "Search for your state bar's lawyer referral service for current contact details." },
];

export interface EmergencyLine { label: string; detail: string; href?: string }

/** Emergency + crisis block. Static numbers only — no generated contact details. */
export function emergencyLines(country: Country): EmergencyLine[] {
  const lines: EmergencyLine[] = [
    { label: "Immediate danger", detail: "Call 911.", href: "tel:911" },
    {
      label: "Thoughts of suicide or self-harm",
      detail: country === "CA"
        ? "Call or text 988 (Suicide Crisis Helpline, 24/7, free)."
        : "Call or text 988 (Suicide & Crisis Lifeline, 24/7, free).",
      href: "tel:988",
    },
  ];
  if (country === "CA") {
    lines.push({ label: "Under 20", detail: "Kids Help Phone: text 686868 or call 1-800-668-6868.", href: "tel:18006686868" });
    lines.push({
      label: "Arrested or detained",
      detail: "You have the right to speak to a lawyer without delay. You can ask police to contact free legal aid duty counsel.",
    });
  } else {
    lines.push({ label: "Domestic violence", detail: "National Domestic Violence Hotline: 1-800-799-7233.", href: "tel:18007997233" });
    lines.push({
      label: "Arrested",
      detail: "You have the right to an attorney. If you cannot afford one, you can ask the court for a public defender.",
    });
  }
  lines.push({
    label: "Court date or legal deadline very soon",
    detail: country === "CA"
      ? "Contact legal aid or the court's duty counsel office as soon as possible."
      : "Contact your local legal aid organization or the court clerk's self-help center as soon as possible.",
  });
  return lines;
}
