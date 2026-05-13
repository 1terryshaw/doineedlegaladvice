"use client";

import { useState, KeyboardEvent } from "react";

interface Props {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  max: number;
  placeholder?: string;
  hint?: string;
}

export default function TagListInput({ label, value, onChange, max, placeholder, hint }: Props) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const merged = [...value];
    for (const p of parts) {
      if (merged.length >= max) break;
      if (!merged.includes(p)) merged.push(p);
    }
    onChange(merged);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="border rounded-lg px-2 py-1.5 flex flex-wrap items-center gap-1 focus-within:ring-2 focus-within:ring-blue-500">
        {value.map((t, i) => (
          <span key={`${t}-${i}`} className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 text-sm rounded-full pl-3 pr-1 py-0.5">
            {t}
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-blue-600 hover:text-blue-900 px-1"
              aria-label={`Remove ${t}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft && commit(draft)}
          placeholder={value.length === 0 ? placeholder : ""}
          disabled={value.length >= max}
          className="flex-1 min-w-[8rem] outline-none px-1 py-1 text-sm bg-transparent"
        />
        <span className="text-xs text-gray-400 ml-auto">{value.length}/{max}</span>
      </div>
      {hint && <small className="block text-xs text-gray-500 mt-1">{hint}</small>}
    </div>
  );
}
