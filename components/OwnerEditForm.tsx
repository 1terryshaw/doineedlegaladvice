"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CANADIAN_PROVINCES, US_STATES } from "@/lib/provinces";
import type { Listing } from "@/lib/supabase";
import { canonical } from "@/lib/vertical-canonical";
import {
  HoursJson,
  ListingExtras,
  ListingPhoto,
} from "@/lib/listing-extras";
import HelpDropdown from "@/components/owner-edit/HelpDropdown";
import TagListInput from "@/components/owner-edit/TagListInput";
import UrlInput from "@/components/owner-edit/UrlInput";
import HoursEditor from "@/components/owner-edit/HoursEditor";
import PhotoUploader from "@/components/owner-edit/PhotoUploader";
import LogoUploader from "@/components/owner-edit/LogoUploader";
import { photoLimitForTier } from "@/lib/photo-limits";
import HeroUploader from "@/components/owner-edit/HeroUploader";
import { can } from "@/lib/tier-capabilities";

interface Props {
  listing: Listing;
  initialName: string;
  initialProvince: string;
  initialPhotos: ListingPhoto[];
  initialLogo: ListingPhoto | null;
}

interface FormState {
  name: string;
  short_description: string;
  description: string;
  phone: string;
  email: string;
  website: string;
  city: string;
  province_state: string;
  hours_json: HoursJson | null;
  services: string[];
  service_area: string[];
  gbp_url: string;
  year_established: string;
  social_instagram: string;
  social_facebook: string;
  social_linkedin: string;
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export default function OwnerEditForm({
  listing,
  initialName,
  initialProvince,
  initialPhotos,
  initialLogo,
}: Props) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const lst = listing as Listing & ListingExtras;

  const [form, setForm] = useState<FormState>({
    name: initialName,
    short_description: listing.short_description || "",
    description: listing.description || "",
    phone: listing.phone || "",
    email: listing.email || "",
    website: listing.website || "",
    city: listing.city || "",
    province_state: initialProvince,
    hours_json: (lst.hours_json as HoursJson | null) ?? null,
    services: lst.services ?? [],
    service_area: lst.service_area ?? [],
    gbp_url: lst.gbp_url ?? "",
    year_established: lst.year_established ? String(lst.year_established) : "",
    social_instagram: lst.social_instagram ?? "",
    social_facebook: lst.social_facebook ?? "",
    social_linkedin: lst.social_linkedin ?? "",
  });

  const [photos, setPhotos] = useState<ListingPhoto[]>(initialPhotos);
  const [logo, setLogo] = useState<ListingPhoto | null>(initialLogo);
  const [heroUrl, setHeroUrl] = useState<string | null>(
    (listing as { hero_image_url?: string | null }).hero_image_url ?? null
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const hasMoreDetails =
    !!form.hours_json ||
    !!form.year_established ||
    !!logo ||
    !!form.social_instagram ||
    !!form.social_facebook ||
    !!form.social_linkedin;
  const [moreOpen, setMoreOpen] = useState(hasMoreDetails);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");

    // Wire format always uses canonical keys: "name" + "province_state".
    // The API route maps these to the actual DB columns via lib/owner-form-bucket.
    const payload = {
      slug: listing.slug,
      name: form.name,
      short_description: form.short_description,
      description: form.description,
      phone: form.phone,
      email: form.email,
      website: form.website ? normalizeUrl(form.website) : "",
      city: form.city,
      province_state: form.province_state,
      hours_json: form.hours_json,
      services: form.services,
      service_area: form.service_area,
      gbp_url: form.gbp_url ? normalizeUrl(form.gbp_url) : "",
      year_established: form.year_established ? parseInt(form.year_established, 10) : null,
      social_instagram: form.social_instagram ? normalizeUrl(form.social_instagram) : "",
      social_facebook: form.social_facebook ? normalizeUrl(form.social_facebook) : "",
      social_linkedin: form.social_linkedin ? normalizeUrl(form.social_linkedin) : "",
    };

    try {
      const res = await fetch("/api/owner/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setErrorMessage("");
        setStatus("saved");
        setTimeout(() => {
          router.refresh();
          router.push(`/owner/${listing.slug}`);
        }, 1000);
      } else {
        let msg = "Failed to save. Please try again.";
        try {
          const data = await res.json();
          if (data?.detail) msg = `Save failed: ${data.detail}`;
          else if (data?.error) msg = `Save failed: ${data.error}`;
        } catch {
          // body wasn't JSON — keep default message
        }
        setErrorMessage(msg);
        setStatus("error");
      }
    } catch {
      // Network/fetch failure — the request may have reached the server.
      // Don't claim "Failed to save" since the write may have actually landed.
      setErrorMessage(
        "Connection issue while saving. Your changes may have gone through — refresh the page to verify before retrying."
      );
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
      <h1 className="text-2xl font-bold">Edit: {form.name || initialName}</h1>

      {status === "saved" && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">
          Saved! Redirecting...
        </div>
      )}
      {status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
          {errorMessage || "Failed to save. Please try again."}
        </div>
      )}

      {/* === Existing core fields === */}
      <section className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
          <input type="text" required value={form.name} onChange={(e) => update("name", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
          <input type="text" value={form.short_description} onChange={(e) => update("short_description", e.target.value)}
            maxLength={160} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <small className="block text-xs text-gray-500 mt-1">{form.short_description.length} / 160</small>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Description</label>
          <textarea rows={5} value={form.description} onChange={(e) => update("description", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
          <input type="text" value={form.website} onChange={(e) => update("website", e.target.value)}
            placeholder="www.example.com"
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input type="text" value={form.city} onChange={(e) => update("city", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Province/State</label>
            <select value={form.province_state} onChange={(e) => update("province_state", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Select region...</option>
              <optgroup label="🇨🇦 Canada">
                {CANADIAN_PROVINCES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </optgroup>
              <optgroup label="───────────" disabled />
              <optgroup label="🇺🇸 United States">
                {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </optgroup>
            </select>
          </div>
        </div>
      </section>

      {/* === High-leverage 4: photos, services, service area, GBP === */}
      <section className="space-y-6 border-t pt-6">
        <h2 className="text-lg font-semibold">Boost your listing</h2>

        <PhotoUploader
          photos={photos}
          onUploaded={(p) => setPhotos((prev) => [...prev, p])}
          onDeleted={(id) => setPhotos((prev) => prev.filter((x) => x.id !== id))}
          max={photoLimitForTier(listing.tier || listing.subscription_tier)}
        />

        {can(listing.tier || listing.subscription_tier, "reviews_display") && (
          <HeroUploader heroUrl={heroUrl} onChange={setHeroUrl} />
        )}

        <TagListInput
          label="Services"
          value={form.services}
          onChange={(v) => update("services", v)}
          max={20}
          placeholder="Drain cleaning, water heater install, ..."
          hint="What you offer — comma-separated. Helps Google match you to specific searches."
        />

        <TagListInput
          label="Service area"
          value={form.service_area}
          onChange={(v) => update("service_area", v)}
          max={10}
          placeholder="Toronto, Mississauga, Vaughan, ..."
          hint="Cities or regions where you take work — comma-separated."
        />

        <UrlInput
          label="Google Business Profile URL"
          value={form.gbp_url}
          onChange={(v) => update("gbp_url", v)}
          kind="gbp"
          helpSlot={
            <HelpDropdown label="Google Business Profile URL">
              <p><strong>What is this?</strong></p>
              <p>Your Google Business Profile is the listing that shows up when someone Googles your business — with the map, hours, reviews, and photos. It&apos;s free.</p>
              <p><strong>How to find yours</strong></p>
              <p>Search Google for your business name. If a panel appears on the right with a map, that&apos;s your profile. Click &ldquo;Own this business?&rdquo; to start claiming. If nothing appears, go to <a href="https://www.google.com/business" target="_blank" rel="noopener" className="text-blue-700 underline">google.com/business</a> to create one.</p>
              <p><strong>How to claim it</strong></p>
              <p>Google will verify by postcard, phone, or video. Takes 5-14 days. Once claimed, copy your profile&apos;s share URL (looks like g.page/YourBusiness or a maps.google.com link) and paste it here.</p>
              <p><strong>Why it matters</strong></p>
              <p>Claimed GBPs rank higher, get more clicks, and let you respond to reviews. It&apos;s the single highest-leverage free thing a local {canonical.noun} can do.</p>
            </HelpDropdown>
          }
        />
      </section>

      {/* === Progressive disclosure: extras === */}
      <section className="border-t pt-6">
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          {moreOpen ? "− Hide additional details" : "+ Add more details"}
        </button>

        {moreOpen && (
          <div className="space-y-6 mt-4">
            <HoursEditor
              value={form.hours_json}
              onChange={(v) => update("hours_json", v)}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year established</label>
              <input
                type="number"
                min={1800}
                max={currentYear}
                value={form.year_established}
                onChange={(e) => update("year_established", e.target.value)}
                placeholder="e.g. 1998"
                className="w-full sm:w-48 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <LogoUploader
              logo={logo}
              onUploaded={(p) => setLogo(p)}
              onDeleted={() => setLogo(null)}
            />

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Social links</h3>
              <UrlInput label="Instagram" value={form.social_instagram} onChange={(v) => update("social_instagram", v)} kind="instagram" />
              <UrlInput label="Facebook" value={form.social_facebook} onChange={(v) => update("social_facebook", v)} kind="facebook" />
              <UrlInput label="LinkedIn" value={form.social_linkedin} onChange={(v) => update("social_linkedin", v)} kind="linkedin" />
            </div>
          </div>
        )}
      </section>

      <div className="flex gap-4 border-t pt-6">
        <button type="submit" disabled={status === "saving"}
          className="px-6 py-2 rounded-lg text-white font-medium disabled:opacity-50"
          style={{ backgroundColor: canonical.primaryColor }}>
          {status === "saving" ? "Saving..." : "Save Changes"}
        </button>
        <button type="button" onClick={() => router.push(`/owner/${listing.slug}`)}
          className="px-6 py-2 border rounded-lg font-medium hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
