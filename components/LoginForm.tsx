"use client";

import { useState } from "react";
import verticalConfig from "@/lib/vertical.config";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");

    try {
      const res = await fetch("/api/owner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus("sent");
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
        <h3 className="text-green-800 font-semibold text-lg">Check your email!</h3>
        <p className="text-green-600 mt-2">We sent a login link to {email}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-center">Owner Login</h2>
      <p className="text-gray-600 text-center text-sm">
        Enter the email associated with your listing to receive a login link.
      </p>
      <div>
        <input
          type="email"
          required
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {status === "error" && (
        <p className="text-red-600 text-sm text-center">Something went wrong. Please try again.</p>
      )}
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full py-3 rounded-lg text-white font-medium disabled:opacity-50"
        style={{ backgroundColor: verticalConfig.primaryColor }}
      >
        {status === "sending" ? "Sending..." : "Send Login Link"}
      </button>
    </form>
  );
}
