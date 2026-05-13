"use client";

import { ReactNode } from "react";
import { isValidGbpUrl, isValidSocial } from "@/lib/listing-extras";

type Kind = "gbp" | "instagram" | "facebook" | "linkedin" | "generic";

interface Props {
  label: string;
  value: string;
  onChange: (next: string) => void;
  kind: Kind;
  placeholder?: string;
  hint?: string;
  helpSlot?: ReactNode;
}

const PLACEHOLDERS: Record<Kind, string> = {
  gbp: "https://g.page/your-business",
  instagram: "https://instagram.com/yourhandle",
  facebook: "https://facebook.com/yourpage",
  linkedin: "https://linkedin.com/company/yourcompany",
  generic: "https://example.com",
};

function isValid(value: string, kind: Kind): boolean {
  if (!value.trim()) return true;
  if (kind === "gbp") return isValidGbpUrl(value);
  if (kind === "generic") return true;
  return isValidSocial(value, kind);
}

export default function UrlInput({ label, value, onChange, kind, placeholder, hint, helpSlot }: Props) {
  const showWarning = !isValid(value, kind);

  return (
    <div>
      <div className="flex items-center mb-1">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {helpSlot}
      </div>
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? PLACEHOLDERS[kind]}
        className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {hint && !showWarning && <small className="block text-xs text-gray-500 mt-1">{hint}</small>}
      {showWarning && (
        <small className="block text-xs text-amber-700 mt-1">
          This doesn&apos;t look like a {label} URL. Double-check before saving.
        </small>
      )}
    </div>
  );
}
