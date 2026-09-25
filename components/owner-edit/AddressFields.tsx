// claimant-edit-ux-stamp-v1 (R2): street + postal/ZIP. Editable only when the edit page
// resolved the row's source class to SELF_SERVE / BUSINESS_SEEDED / MIXED; every other
// class sees the stored values read-only. The route re-checks the class — this is UX only.
export default function AddressFields({
  editable,
  address,
  postalCode,
  country,
  onChange,
}: {
  editable: boolean;
  address: string;
  postalCode: string;
  country: string;
  onChange: (field: "address" | "postal_code", value: string) => void;
}) {
  const postalLabel = country === "US" ? "ZIP code" : "Postal code";
  const postalHint = country === "US" ? "12345 or 12345-6789" : "A1A 1A1";
  const input = "w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (!editable) {
    return (
      <div id="business-address" className="rounded-lg border border-gray-200 p-4">
        <p className="block text-sm font-medium text-gray-700">Business address</p>
        <p className="mt-1 text-sm text-gray-800">
          {[address, postalCode].filter(Boolean).join(", ") || "No street address on file."}
        </p>
        <p className="mt-1 text-sm text-gray-500">Contact us to change your address.</p>
      </div>
    );
  }

  return (
    <div id="business-address" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="sm:col-span-2">
        <label htmlFor="owner-street" className="block text-sm font-medium text-gray-700 mb-1">Street address</label>
        <input id="owner-street" type="text" maxLength={120} value={address} autoComplete="street-address"
          onChange={(e) => onChange("address", e.target.value)} placeholder="123 Main St, Suite 4" className={input} />
      </div>
      <div>
        <label htmlFor="owner-postal" className="block text-sm font-medium text-gray-700 mb-1">{postalLabel}</label>
        <input id="owner-postal" type="text" maxLength={10} value={postalCode} autoComplete="postal-code"
          onChange={(e) => onChange("postal_code", e.target.value)} placeholder={postalHint} className={input} />
      </div>
      <small className="sm:col-span-3 -mt-2 block text-xs text-gray-500">
        Changing your street, city or province updates your listing within a few minutes. The map pin is
        hidden until it can be refreshed for the new address.
      </small>
    </div>
  );
}
