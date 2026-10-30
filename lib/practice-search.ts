const PRACTICE_TERMS = [
  "family law", "family", "divorce", "custody", "immigration", "visa",
  "criminal", "dui/dwi", "dui", "dwi", "personal injury", "bankruptcy",
  "employment", "estate planning", "estate", "wills", "will", "real estate",
  "tax", "business", "intellectual property", "ip", "patent", "trademark",
];

/** Return the practice-area phrase when the whole query is a known practice term. */
export function detectPracticeTerm(query: string): string | null {
  const normalized = query.trim().toLocaleLowerCase("en-US");
  if (!normalized) return null;
  return PRACTICE_TERMS.some((term) => new RegExp(`^\\b${term}\\b$`, "i").test(normalized))
    ? query.trim()
    : null;
}
