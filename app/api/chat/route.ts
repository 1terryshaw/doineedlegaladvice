import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { freeformLegalChatEnabled, CHAT_DISABLED_BODY } from "@/lib/legal-chat-gate"; // TDL #1402
import verticalConfig from "@/lib/vertical.config";
// advisor-no-competitor v1 — K35: the prompt clause is a request, the guard is the control.
import { withNoCompetitorRule, noCompetitor } from "@/lib/advisor-no-competitor";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic();

// In-memory rate limiter: 10 requests per IP per minute
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60_000;
  const maxRequests = 10;

  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= maxRequests) {
    rateLimitMap.set(ip, recent);
    return true;
  }

  recent.push(now);
  rateLimitMap.set(ip, recent);
  return false;
}

export async function POST(request: NextRequest) {
  // TDL #1402: generative legal chat is OFF unless LEGAL_FREEFORM_CHAT_ENABLED === "true".
  // Returns before rate-limit, body parse or any Anthropic call — no LLM output, nothing stored.
  if (!freeformLegalChatEnabled()) {
    return NextResponse.json(CHAT_DISABLED_BODY, { status: 410, headers: { "Cache-Control": "no-store" } });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { messages } = await request.json();

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "Messages required" }, { status: 400 });
  }

  try {
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: 300,
      system: withNoCompetitorRule(verticalConfig.chatSystemPrompt),
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return NextResponse.json({ message: noCompetitor(textBlock?.text || "Sorry, I couldn't generate a response.", messages) });
  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json({ error: "Chat unavailable" }, { status: 500 });
  }
}
