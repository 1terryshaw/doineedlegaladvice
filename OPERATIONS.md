# doineedlegaladvice — Operations

## Vercel WAF

- 2026-09-11 — WAF rule `TDL983 chat sustained cap` (`rule_tdl_983_chat_sustained_cap_trdC15`, 100 req / 3600s per IP on `POST /api/chat`) flipped `deny` → `rate_limit`: it was returning a hard 403 on the chat route, so over-cap users now get a 429 instead of being blocked. Scope, window and limit unchanged; burst rule `TDL983 chat burst limit` (10/60s) and the junk-crawler deny rule untouched. Firewall config v7 → v10; before/after JSON in `~/empire/qa/2026-09-11/`.
