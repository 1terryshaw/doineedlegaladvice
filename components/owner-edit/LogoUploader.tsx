"use client";

import { useRef, useState } from "react";
import { ListingPhoto, ACCEPTED_MIME, MAX_PHOTO_BYTES } from "@/lib/listing-extras";

interface Props {
  logo: ListingPhoto | null;
  onUploaded: (logo: ListingPhoto) => void;
  onDeleted: () => void;
}

export default function LogoUploader({ logo, onUploaded, onDeleted }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!ACCEPTED_MIME.includes(file.type)) {
      setError("Only JPEG, PNG, or WebP allowed.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError(`File too large (max ${MAX_PHOTO_BYTES / 1024 / 1024}MB).`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("photo_kind", "logo");
      const res = await fetch("/api/photos/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed.");
        return;
      }
      onUploaded({
        id: data.id,
        public_url: data.public_url,
        display_order: data.display_order,
        photo_kind: "logo",
      });
    } catch {
      setError("Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteLogo() {
    if (!logo) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/photos/${logo.id}`, { method: "DELETE" });
      if (res.ok) onDeleted();
      else setError("Could not delete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
      <small className="block text-gray-500 mb-2">Square crop suggested. JPEG, PNG, or WebP, max 5MB.</small>
      <div className="flex items-center gap-4">
        {logo ? (
          <div className="relative w-24 h-24 border rounded-lg overflow-hidden bg-white">
            { /* eslint-disable-next-line @next/next/no-img-element */ }
            <img src={logo.public_url} alt="Logo" className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 text-xs">
            No logo
          </div>
        )}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy || !!logo}
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {busy ? "Uploading..." : logo ? "Replace below" : "Upload logo"}
          </button>
          {logo && (
            <button
              type="button"
              onClick={deleteLogo}
              disabled={busy}
              className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              Remove logo
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_MIME.join(",")}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
