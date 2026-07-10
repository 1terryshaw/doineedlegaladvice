import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";
import type { UkFirm } from "@/lib/uk-solicitors";
import RegulatorBadge from "@/components/uk/RegulatorBadge";

const TYPE_LABEL: Record<string, string> = {
  ltd: "Limited Company",
  plc: "PLC",
  llp: "LLP",
};

export default function UkListingCard({ firm }: { firm: UkFirm }) {
  const slug = firm.id;
  const typeLabel = firm.company_type ? TYPE_LABEL[firm.company_type] ?? null : null;

  return (
    <Link
      href={`/uk/directory/${slug}`}
      className="block border rounded-xl p-6 hover:translate-y-[-4px] hover:shadow-lg transition-all duration-200 bg-white overflow-hidden relative"
    >
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{
          background: `linear-gradient(to right, ${verticalConfig.primaryColor}, transparent)`,
        }}
      />
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {firm.business_name}
          </h3>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {firm.town && (
              <span className="text-xs text-gray-600 bg-gray-100 rounded-full px-3 py-1">
                {firm.town}
              </span>
            )}
            {firm.county && firm.county !== firm.town && (
              <span className="text-xs text-gray-600 bg-gray-100 rounded-full px-3 py-1">
                {firm.county}
              </span>
            )}
          </div>
        </div>
        {firm.is_claimed && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 bg-gray-100 text-gray-700 border border-gray-200 text-xs font-medium px-2 py-0.5 rounded-full" title="Claimed: the business owner confirmed this listing by email.">
            Claimed
          </span>
        )}
      </div>

      {typeLabel && (
        <span
          className="inline-block text-xs font-medium px-2.5 py-0.5 rounded-full mt-2"
          style={{
            backgroundColor: `${verticalConfig.primaryColor}15`,
            color: verticalConfig.primaryColor,
          }}
        >
          {typeLabel}
        </span>
      )}

      {firm.postcode && (
        <p className="text-gray-500 mt-3 text-sm">{firm.postcode}</p>
      )}

      {firm.jurisdiction && (
        <div className="mt-2">
          <RegulatorBadge jurisdiction={firm.jurisdiction} variant="compact" />
        </div>
      )}

      <div className="mt-3 pt-3 border-t">
        <span
          className="text-sm font-medium"
          style={{ color: verticalConfig.primaryColor }}
        >
          View Details &rarr;
        </span>
      </div>
    </Link>
  );
}
