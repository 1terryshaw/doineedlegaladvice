"use client";

import { useRef, useState } from "react";
import { ListingPhoto, ACCEPTED_MIME, MAX_PHOTO_BYTES } from "@/lib/listing-extras";

interface Props {
  photos: ListingPhoto[];
  onUploaded: (photo: ListingPhoto) => void;
  onDeleted: (id: string) => void;
  max: number;
}

export default function PhotoUploader({ photos, onUploaded, onDeleted, max }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const slotsLeft = max - photos.length;

  async function uploadFile(file: File) {
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
      fd.append("photo_kind", "photo");
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
        photo_kind: "photo",
      });
    } catch {
      setError("Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files).slice(0, slotsLeft);
    for (const f of list) {
      await uploadFile(f);
    }
  }

  async function deletePhoto(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/photos/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Could not delete.");
        return;
      }
      onDeleted(id);
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    if (slotsLeft <= 0) return;
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Photos ({photos.length}/{max})
      </label>
      <small className="block text-gray-500 mb-2">
        First photo is your hero image. Up to {max}, max 5MB each. JPEG, PNG, or WebP.
      </small>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {photos.map((p, i) => (
          <div key={p.id} className="relative group rounded-lg overflow-hidden border bg-gray-50 aspect-[4/3]">
            { /* eslint-disable-next-line @next/next/no-img-element */ }
            <img src={p.public_url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
            {i === 0 && (
              <span className="absolute top-2 left-2 bg-blue-700 text-white text-[10px] font-bold px-2 py-0.5 rounded">HERO</span>
            )}
            <button
              type="button"
              onClick={() => deletePhoto(p.id)}
              disabled={busy}
              className="absolute top-2 right-2 bg-white/90 hover:bg-white text-red-600 text-xs font-medium px-2 py-1 rounded shadow disabled:opacity-50"
              aria-label="Delete photo"
            >
              Delete
            </button>
          </div>
        ))}

        {slotsLeft > 0 && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className={`aspect-[4/3] rounded-lg border-2 border-dashed flex items-center justify-center text-center p-3 cursor-pointer ${
              drag ? "border-blue-600 bg-blue-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"
            }`}
            onClick={() => inputRef.current?.click()}
          >
            <div className="text-sm text-gray-600">
              <div className="font-medium">{busy ? "Uploading..." : "Add photo"}</div>
              <div className="text-xs text-gray-500 mt-1">Click or drop here</div>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_MIME.join(",")}
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
