"use client";

import { useState } from "react";
import verticalConfig from "@/lib/vertical.config";

const vc = verticalConfig as unknown as {
  primaryColor: string;
  categories?: { slug: string; label: string }[];
};

export default function InquiryForm({ listingSlug }: { listingSlug: string }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
    urgency: "flexible",
    serviceNeeded: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");

    try {
      const res = await fetch("/api/forward-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, listingSlug }),
      });
      if (res.ok) {
        setStatus("sent");
        setForm({
          name: "",
          email: "",
          phone: "",
          message: "",
          urgency: "flexible",
          serviceNeeded: "",
        });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <p className="text-green-800 font-medium">Your inquiry has been sent!</p>
        <p className="text-green-600 text-sm mt-1">
          The business will receive your details within seconds.
        </p>
      </div>
    );
  }

  const categories = vc.categories;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-semibold text-lg">Send an Inquiry</h3>
      <div>
        <input
          type="text"
          placeholder="Your name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <input
          type="email"
          placeholder="Your email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <input
          type="tel"
          placeholder="Phone (optional)"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <select
          value={form.urgency}
          onChange={(e) => setForm({ ...form, urgency: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="flexible">Flexible — no rush</option>
          <option value="urgent">Urgent — need help today</option>
          <option value="emergency">Emergency — happening now</option>
        </select>
      </div>
      {categories && categories.length > 0 && (
        <div>
          <select
            value={form.serviceNeeded}
            onChange={(e) =>
              setForm({ ...form, serviceNeeded: e.target.value })
            }
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Service needed (optional)</option>
            {categories.map((cat) => (
              <option key={cat.slug} value={cat.label}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <textarea
          placeholder="Describe what you need help with"
          required
          rows={4}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {status === "error" && (
        <p className="text-red-600 text-sm">Failed to send. Please try again.</p>
      )}
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full py-2 rounded-lg text-white font-medium disabled:opacity-50"
        style={{ backgroundColor: vc.primaryColor }}
      >
        {status === "sending" ? "Sending..." : "Send Inquiry"}
      </button>
    </form>
  );
}
