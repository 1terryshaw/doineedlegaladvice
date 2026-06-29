"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "I got an eviction notice",
  "I was just laid off",
  "I need to file for divorce",
  "I was arrested",
  "I'm trying to get a green card",
];

export default function TriageChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const next: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("You've hit the rate limit. Please wait a minute.");
        }
        throw new Error("Triage is temporarily unavailable.");
      }
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.message }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  const turnCount = messages.filter((m) => m.role === "user").length;
  const showDirectoryCta = turnCount >= 3 && !loading;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
      <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-700">
          Triage Helper &mdash; tells you what kind of attorney to look for
        </div>
        <div className="text-[10px] uppercase tracking-wide text-gray-500">
          Not legal advice
        </div>
      </div>

      <div
        ref={scrollRef}
        className="min-h-[8rem] max-h-80 overflow-y-auto px-5 py-4 space-y-3 bg-white"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="text-gray-500 text-sm">
            <p className="mb-3">
              Describe your situation in your own words. I&apos;ll ask a couple of clarifying
              questions, then tell you what kind of attorney can help &mdash; not what to do.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-500 rounded-2xl px-4 py-2 text-sm">
              Thinking&hellip;
            </div>
          </div>
        )}
        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>

      {showDirectoryCta && (
        <div className="px-5 py-3 bg-emerald-50 border-t border-emerald-100 text-sm flex items-center justify-between">
          <span className="text-emerald-800">
            Ready to browse attorneys in your area?
          </span>
          <Link
            href="/directory"
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition"
          >
            Open directory
          </Link>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="px-5 py-3 border-t bg-gray-50 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe your situation..."
          aria-label="Describe your situation"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg transition"
        >
          Send
        </button>
      </form>

      <div className="px-5 py-2 bg-gray-50 border-t text-[11px] text-gray-500 text-center">
        Conversations may be processed by Anthropic Claude and stored to improve the service.
        Not attorney-client privileged. Don&apos;t share SSN or account credentials.
      </div>
    </div>
  );
}
