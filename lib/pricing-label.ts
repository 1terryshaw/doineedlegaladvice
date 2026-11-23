/** Display-only currency label. Amounts and checkout requests stay unchanged.
 * Only Canadian listing offers are relabelled; other countries retain their copy.
 */
export function pricingLabel(text: string, country?: string | null): string {
  if (country !== "CA") return text;
  return text.replace(/\$([\d,.]+)(?: USD)?(\/(?:month|year|mo|yr))?(?: USD)?/g,
    (_, amount: string, period: string | undefined) => `$${amount} CAD${period ?? ""}`
  ).replace(/\bUSD\b/g, "CAD");
}
