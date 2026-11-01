// legal-chat-gate.ts — TDL #1402. STAMPED, byte-identical in freelawyeradvice + doineedlegaladvice.
//
// The generative legal chat (/api/chat, and /api/triage on DINLA) is DISABLED by default.
// It was observed on 2026-11-01 giving individualized advice, outcome predictions and
// limitation-deadline determinations (mission legal-liability-containment-and-consolidation-v1).
//
// Re-enabling is a COUNSEL + CEO gate, not an engineering toggle. The switch exists only so
// containment is reversible: set LEGAL_FREEFORM_CHAT_ENABLED=true in the Vercel project env
// and redeploy. Anything other than the exact string "true" keeps the chat off (fail-closed).

export function freeformLegalChatEnabled(): boolean {
  return process.env.LEGAL_FREEFORM_CHAT_ENABLED === "true";
}

export const CHAT_DISABLED_BODY = {
  error: "chat_disabled",
  message:
    "The free-form chat has been replaced by a step-by-step legal-help navigator. No AI response is generated and nothing you send is stored.",
  navigator: "/#navigator",
} as const;
