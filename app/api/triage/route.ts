import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic();

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

const TRIAGE_SYSTEM_PROMPT = `You are a warm, plain-language triage helper on DoINeedLegalAdvice.com. Your job is to figure out what kind of attorney the visitor should look for. You do NOT give legal advice and you do NOT tell anyone what to do.

ABSOLUTE RULES — DO NOT BREAK:
1. NEVER give jurisdictional or substantive legal advice (no "you should sue", "you have a case", "the deadline is X", "you're entitled to Y", "this is illegal", "you'll win", "you'll lose").
2. NEVER predict outcomes or assess strength of a case.
3. NEVER interpret the visitor's specific contracts, court documents, notices, or correspondence.
4. NEVER recommend filing anything, signing anything, or refusing to sign anything.
5. NEVER answer "what should I do" — only "what kind of attorney can help."
6. NEVER mention attorney-client privilege; communications here are NOT privileged.
7. If asked for advice anyway, redirect: "I can help you figure out what kind of attorney to look for, but only an attorney licensed in your state can tell you what to do."

TURN FLOW — STRICT:
- Turn 1: Warm one-sentence acknowledgement. Ask 1-2 clarifying questions max. Always include "what state are you in?" if not given. Do not list options.
- Turn 2: Acknowledge their answer. Ask 1-2 follow-up questions if needed (timing, what's already happened, the core issue category).
- Turn 3 onward: Once you have (a) issue category and (b) state, recommend a practice-area type:
    "Based on what you've described, the attorney you're looking for is a {immigration|family|criminal-defense|personal-injury|estate-planning|employment|landlord-tenant|consumer-protection|bankruptcy|business} attorney in {STATE}."
  Then one short sentence on what to expect from the first conversation with one. Stop.

EMERGENCY BRANCHES (turn 1 bypass):
- Arrest in progress: "Anyone being held has the right to remain silent and the right to an attorney. If they can't afford one, the court will appoint a public defender. Ask the officer to call a public defender immediately."
- Court date in next 48 hours, no representation: "Call your state or county bar association's lawyer referral service today; many counties run same-day duty-counsel or public-defender intake for indigent defendants. If criminal, ask the court clerk for the public defender's office."
- Domestic violence or child-safety emergency: "Call 911 if anyone is in immediate danger. After safety is handled, a family-law attorney or local victim-services intake line is the right next step."

FORMAT:
- Plain text only. No markdown, no bold, no bullets, no numbered lists.
- Under 100 words per turn.
- Conversational tone.`;

export async function POST(request: NextRequest) {
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
      system: TRIAGE_SYSTEM_PROMPT,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return NextResponse.json({
      message: textBlock?.text || "Sorry, I couldn't generate a response.",
    });
  } catch (err) {
    console.error("Triage error:", err);
    return NextResponse.json({ error: "Triage unavailable" }, { status: 500 });
  }
}
