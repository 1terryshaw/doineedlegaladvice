export default function LegalDisclaimer() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 items-start">
      <span className="text-amber-600 text-xl flex-shrink-0" aria-hidden="true">
        &#9888;&#65039;
      </span>
      <p className="text-sm text-amber-800">
        <strong>Disclaimer:</strong> FreeLawyerAdvice.ca provides general legal information only.
        This is not legal advice and does not create a lawyer-client relationship. Always consult
        with a qualified lawyer for advice specific to your situation.
      </p>
    </div>
  );
}
