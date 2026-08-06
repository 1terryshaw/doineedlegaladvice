"use client";

import { useState } from "react";
import verticalConfig from "@/lib/vertical.config";

interface Props {
  slug: string; // company_number
  firmName: string;
}

export default function UkClaimForm({ slug, firmName }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch("/api/uk/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, email, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setStatus("sent");
      } else {
        setStatus("error");
        setMessage(data.userMessage || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again in a moment.");
    }
  }

  if (status === "sent") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <span className="text-green-600 text-3xl">&#9993;</span>
        <h2 className="text-xl font-bold text-green-800 mt-3">Check your email</h2>
        <p className="text-sm text-green-700 mt-2">
          We&apos;ve sent a verification link to <strong>{email}</strong>. Click it to
          confirm control of <strong>{firmName}</strong> and mark your listing as Claimed
          — it&apos;s free.
        </p>
        <p className="text-xs text-gray-500 mt-3">
          Didn&apos;t get it? Check spam, or use an email at the business&apos;s own domain.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Claim {firmName}</h1>
        <p className="text-sm text-gray-600 mt-2">
          Confirm you control this business to get a free <strong>Claimed</strong> badge
          on your listing. We&apos;ll email you a one-click verification link — no payment.
        </p>
      </div>

      <div>
        <label htmlFor="uk-claim-name" className="block text-sm font-medium text-gray-700 mb-1">
          Your name
        </label>
        <input
          id="uk-claim-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        />
      </div>

      <div>
        <label htmlFor="uk-claim-email" className="block text-sm font-medium text-gray-700 mb-1">
          Your email
        </label>
        <input
          id="uk-claim-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
        />
        <p className="text-xs text-gray-400 mt-1">
          Use an email at the business&apos;s own domain where possible.
        </p>
      </div>

      {status === "error" && (
        <p className="text-sm text-red-600">{message}</p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-60"
        style={{ backgroundColor: verticalConfig.primaryColor }}
      >
        {status === "sending" ? "Sending…" : "Send verification link"}
      </button>
    </form>
  );
}
