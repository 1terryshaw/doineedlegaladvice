"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import verticalConfig from "@/lib/vertical.config";
import { LISTING_TYPES } from "@/lib/constants";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface RouteInfo {
  slug: string;
  label: string;
}

interface ChatWidgetProps {
  inline?: boolean;
}

function parseRoute(content: string): RouteInfo | null {
  const match = content.match(/ROUTE:\[?([a-z-]+)\]?/);
  if (!match) return null;
  const slug = match[1];
  const type = LISTING_TYPES.find((t) => t.slug === slug);
  const label = type ? type.name.replace(" Lawyer", "") : slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { slug, label };
}

function stripRoute(content: string): string {
  return content.replace(/ROUTE:\[?[a-z-]+\]?/g, "").trim();
}

export default function ChatWidget({ inline = false }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

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
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: userMessage }],
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const chatBox = (
    <div className={inline ? "bg-white border rounded-lg shadow-lg w-full flex flex-col" : "bg-white border rounded-lg shadow-xl w-80 sm:w-96 flex flex-col"}>
      <div
        className="flex justify-between items-center p-4 rounded-t-lg text-white"
        style={{ backgroundColor: verticalConfig.primaryColor }}
      >
        <span className="font-semibold">
          {inline ? "Describe your legal situation" : "Chat with us"}
        </span>
        {!inline && (
          <button onClick={() => setIsOpen(false)} className="text-white hover:opacity-80">
            &#10005;
          </button>
        )}
      </div>
      <div
        ref={messagesContainerRef}
        className="min-h-[120px] overflow-y-auto p-4 space-y-3"
        style={{ maxHeight: "400px" }}
      >
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm text-center mt-8">
            {inline
              ? "Tell us about your legal situation and we\u2019ll help you find the right type of lawyer."
              : `Ask us anything about finding the right ${verticalConfig.listingNoun}!`}
          </p>
        )}
        {messages.map((msg, i) => {
          const route = msg.role === "assistant" ? parseRoute(msg.content) : null;
          return (
            <div key={i}>
              <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === "user" ? "text-white" : "bg-gray-100 text-gray-800"
                  }`}
                  style={msg.role === "user" ? { backgroundColor: verticalConfig.primaryColor } : undefined}
                >
                  {msg.role === "assistant" ? stripRoute(msg.content) : msg.content}
                </div>
              </div>
              {route && (
                <div className="flex justify-start mt-2">
                  <Link
                    href={`/directory?type=${route.slug}`}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: verticalConfig.ctaColor }}
                  >
                    Browse {route.label} Lawyers &rarr;
                  </Link>
                </div>
              )}
            </div>
          );
        })}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-500">Thinking...</div>
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="border-t p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={inline ? "e.g. My landlord won\u2019t return my deposit..." : "Type a message..."}
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
          style={{ "--tw-ring-color": verticalConfig.primaryColor } as React.CSSProperties}
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: verticalConfig.ctaColor }}
        >
          Send
        </button>
      </form>
    </div>
  );

  if (inline) {
    return chatBox;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen ? (
        chatBox
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-full text-white shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center text-2xl"
          style={{ backgroundColor: verticalConfig.primaryColor }}
        >
          &#128172;
        </button>
      )}
    </div>
  );
}
