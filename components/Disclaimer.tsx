import verticalConfig from "@/lib/vertical.config";

export default function Disclaimer() {
  return (
    <div
      role="note"
      aria-label="Legal disclaimer"
      className="w-full bg-amber-50 border-b border-amber-200 text-amber-900 text-xs sm:text-sm py-2 px-4 text-center"
    >
      <span className="font-semibold">Disclaimer:</span>{" "}
      This is not legal advice. No attorney-client relationship is formed by using this directory.
      {verticalConfig.name} is an information service only — always consult a qualified attorney
      licensed in your jurisdiction for advice on your specific situation.
    </div>
  );
}
