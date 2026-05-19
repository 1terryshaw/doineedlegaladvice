"use client";

import { useState } from "react";
import verticalConfig from "@/lib/vertical.config";

export default function ClaimForm({ listingSlug, listingName }: { listingSlug: string; listingName: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");

    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: listingSlug, email, name }),
      });
      let data: { success?: boolean; error?: string; userMessage?: string } | null = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (res.ok && data?.success) {
        setStatus("sent");
      } else {
        setErrorMsg(
          data?.userMessage ||
            data?.error ||
            "We couldn't process your claim right now. Please try again in a moment."
        );
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <h3 className="text-green-800 font-semibold text-lg">Verification email sent!</h3>
        <p className="text-green-600 mt-2">Check your email and click the verification link to claim your listing.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-bold">Claim &ldquo;{listingName}&rdquo;</h2>
      <p className="text-gray-600 text-sm">
        Verify your ownership to manage this listing on {verticalConfig.name}.
      </p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Business Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {status === "error" && <p className="text-red-600 text-sm">{errorMsg}</p>}
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full py-2 rounded-lg text-white font-medium disabled:opacity-50"
        style={{ backgroundColor: verticalConfig.primaryColor }}
      >
        {status === "sending" ? "Submitting..." : "Claim This Listing"}
      </button>
    </form>
  );
}
