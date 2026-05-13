"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AIChatAdvisor() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const messageCount = messages.filter((m) => m.role === "user").length;

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error === "Rate limit exceeded" ? "You're sending messages too quickly. Please wait a moment and try again." : "Sorry, I encountered an error. Please try again." },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border rounded-xl shadow-sm max-w-2xl mx-auto">
      <div className="bg-[#1a365d] text-white p-4 rounded-t-xl">
        <h3 className="font-semibold text-lg">Legal Advisor</h3>
        <p className="text-sm opacity-80">Tell us what you&apos;re dealing with — we&apos;ll point you in the right direction</p>
      </div>

      <div ref={messagesContainerRef} className="p-4 min-h-[200px] max-h-[400px] overflow-y-auto space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">
            Tell us about your situation — criminal, family, employment, landlord-tenant, anything — and we&apos;ll help you figure out next steps.
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-4 py-2 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#1a365d] text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2 text-sm text-gray-500">Thinking...</div>
          </div>
        )}

      </div>

      <div className="border-t p-4">
        {messageCount >= 3 ? (
          <Link
            href="/directory"
            className="block w-full py-3 rounded-lg text-white font-semibold text-center bg-[#1a365d] hover:bg-[#0f2440] transition-colors"
          >
            Find a Lawyer Near You
          </Link>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell us what's going on..."
              className="flex-1 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a365d]"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 bg-[#1a365d] hover:bg-[#0f2440] transition-colors"
            >
              Send
            </button>
          </form>
        )}
        <p className="text-xs text-gray-400 mt-2 text-center">
          This is AI-generated guidance, not professional advice.
        </p>
      </div>
    </div>
  );
}
