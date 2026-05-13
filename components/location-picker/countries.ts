export const COUNTRIES = {
  AU: { name: 'Australia', flag: '\u{1F1E6}\u{1F1FA}', locale: ['en-AU'] },
  CA: { name: 'Canada', flag: '\u{1F1E8}\u{1F1E6}', locale: ['en-CA', 'fr-CA'] },
  MX: { name: 'Mexico', flag: '\u{1F1F2}\u{1F1FD}', locale: ['es-MX'] },
  NZ: { name: 'New Zealand', flag: '\u{1F1F3}\u{1F1FF}', locale: ['en-NZ'] },
  GB: { name: 'United Kingdom', flag: '\u{1F1EC}\u{1F1E7}', locale: ['en-GB'] },
  US: { name: 'United States', flag: '\u{1F1FA}\u{1F1F8}', locale: ['en-US'] },
} as const;

export type CountryCode = keyof typeof COUNTRIES;

/** Map ISO country code to locale hints for fallback geo detection */
export function getCountryFromLocale(locale: string): CountryCode | null {
  for (const [code, info] of Object.entries(COUNTRIES)) {
    if (info.locale.some((l) => locale.startsWith(l))) {
      return code as CountryCode;
    }
  }
  return null;
}
