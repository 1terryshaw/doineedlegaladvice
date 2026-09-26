// owner-journey-friction-fix-v1 B (ruling 17): DISPLAY-only phone formatting per country.
// The stored value is never changed; anything we can't confidently format is shown as stored.
export function formatPhoneDisplay(raw: string | null | undefined, country?: string | null): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const digits = s.replace(/\D/g, "");
  const c = (country ?? "").trim().toUpperCase();
  const nanp = !c || c === "CA" || c === "US" || c === "USA" || c === "CANADA";
  if (nanp && (digits.length === 10 || (digits.length === 11 && digits.startsWith("1")))) {
    const d = digits.slice(-10);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (c === "GB" || c === "UK") {
    const n = digits.startsWith("44") ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : digits;
    if (n.length === 10) {
      if (n.startsWith("20")) return `020 ${n.slice(2, 6)} ${n.slice(6)}`;
      if (n.startsWith("7")) return `07${n.slice(1, 4)} ${n.slice(4)}`;
      return `0${n.slice(0, 4)} ${n.slice(4)}`;
    }
  }
  return s;
}
