"use client";

import { useRef, useState, ChangeEvent } from "react";

interface Props {
  heroUrl: string | null;
  onChange: (url: string | null) => void;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

/**
 * Hero cover image uploader — a wide banner shown at the top of the public
 * listing. A Reviews Plus feature; the /api/photos/hero route enforces the
 * tier gate server-side.
 */
export default function HeroUploader({ heroUrl, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setErr("Exceeds 5MB");
      return;
    }
    if (!ALLOWED.includes(file.type)) {
      setErr("Only jpeg/png/webp");
      return;
    }
    setErr(null);
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/photos/hero", { method: "POST", body: fd });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error || "Upload failed");
      return;
    }
    const row = await res.json();
    onChange(row.hero_image_url);
  }

  async function handleDelete() {
    setErr(null);
    const res = await fetch("/api/photos/hero", { method: "DELETE" });
    if (res.ok) onChange(null);
    else setErr("Delete failed");
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Hero cover image{" "}
        <span className="text-gray-400 font-normal">
          (wide banner at the top of your listing)
        </span>
      </label>
      <div className="aspect-[3/1] bg-gray-100 rounded-lg overflow-hidden border flex items-center justify-center relative">
        {heroUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroUrl} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={handleDelete}
              aria-label="Remove hero image"
              className="absolute top-2 right-2 bg-white/90 hover:bg-white text-red-600 rounded-full w-7 h-7 flex items-center justify-center text-sm shadow"
            >
              ×
            </button>
          </>
        ) : (
          <span className="text-xs text-gray-400">No cover image</span>
        )}
      </div>
      <div className="mt-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {busy ? "Uploading..." : heroUrl ? "Replace cover image" : "Upload cover image"}
        </button>
        <div className="text-[10px] text-gray-400 mt-1">
          Wide image works best · JPG, PNG, WEBP · max 5MB
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onPick}
      />
      {err && <div className="text-xs text-red-600 mt-2">{err}</div>}
    </div>
  );
}
