#!/usr/bin/env node
// check-client-imports.mjs — INCIDENT GUARD (leads-plus-canary-v1 fixup-2, CEO 2026-10-09). Runs in `prebuild`.
// FAILS THE BUILD if any 'use client' file reaches — directly or through any chain of VALUE imports — a server-only
// module: one that constructs the Stripe client, reads the service-role Supabase key, or imports "server-only".
// Why: 0e8fdaf pulled the Stripe client into the owner dashboard's browser bundle; every owner dashboard crashed at
// hydration, and an SSR-only curl could not see it. Type-only imports are erased by TypeScript and are allowed.
//   node scripts/check-client-imports.mjs            exit 0 = clean, exit 1 = violation(s) listed
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN = ["app", "components", "lib"].map((d) => join(ROOT, d)).filter(existsSync);
const EXT = [".ts", ".tsx", ".js", ".jsx", ".mjs"];
const SERVER_ONLY = [
  [/new\s+Stripe\s*\(/, "constructs the Stripe client"],
  [/from\s+["']stripe["']/, "imports the Stripe Node SDK"],
  [/SUPABASE_SERVICE_ROLE_KEY/, "reads the service-role Supabase key"],
  [/^\s*import\s+["']server-only["']/m, 'imports "server-only"'],
];

const walk = (d, out = []) => {
  for (const e of readdirSync(d)) {
    if (e === "node_modules" || e.startsWith(".")) continue;
    const f = join(d, e);
    if (statSync(f).isDirectory()) walk(f, out); else if (EXT.some((x) => f.endsWith(x))) out.push(f);
  }
  return out;
};
const src = new Map();
const read = (f) => { if (!src.has(f)) src.set(f, readFileSync(f, "utf8")); return src.get(f); };

function resolveSpec(from, spec) {
  let base;
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null; // a package — only the Stripe SDK matters, and the file-level marker catches its importer
  for (const c of [base, ...EXT.map((x) => base + x), ...EXT.map((x) => join(base, "index" + x))]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

// Names a module exports ONLY as types (interface / type alias) — importing just these is erased at compile time.
function typeOnlyExports(file) {
  const s = read(file), names = new Set();
  for (const m of s.matchAll(/export\s+(?:declare\s+)?(?:interface|type)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  return names;
}

function valueImports(file) {
  const s = read(file), out = [];
  const re = /(?:^|\n)\s*(import|export)\s+(type\s+)?([\s\S]*?)\s*from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
  for (const m of s.matchAll(re)) {
    const spec = m[4] || m[5] || m[6];
    if (m[2]) continue; // `import type … from` / `export type … from`
    const target = resolveSpec(file, spec);
    if (!target) continue;
    const clause = m[3] || "";
    const named = /^\{([\s\S]*)\}$/.exec(clause.trim());
    if (named) {
      const parts = named[1].split(",").map((x) => x.trim()).filter(Boolean);
      const types = typeOnlyExports(target);
      const allTypes = parts.every((p) => p.startsWith("type ") || types.has(p.split(/\s+as\s+/)[0].trim()));
      if (allTypes) continue;
    }
    out.push(target);
  }
  return out;
}

const serverReason = (f) => { const s = read(f); for (const [re, why] of SERVER_ONLY) if (re.test(s)) return why; return null; };

const files = SCAN.flatMap((d) => walk(d));
// The directive may follow comments (Next allows it as the first STATEMENT) — strip leading comments first.
const stripLead = (s) => s.replace(/^(?:\s+|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, "");
const clients = files.filter((f) => /^(["'])use client\1/.test(stripLead(read(f))));
const violations = [];
for (const c of clients) {
  const seen = new Set([c]), stack = [[c, [c]]];
  while (stack.length) {
    const [f, chain] = stack.pop();
    for (const t of valueImports(f)) {
      if (seen.has(t)) continue;
      seen.add(t);
      const why = serverReason(t);
      if (why) { violations.push({ chain: [...chain, t].map((x) => relative(ROOT, x)), why }); continue; }
      stack.push([t, [...chain, t]]);
    }
  }
}
if (violations.length) {
  console.error(`check-client-imports: ${violations.length} 'use client' file(s) reach a server-only module — BUILD BLOCKED`);
  for (const v of violations) console.error(`  ${v.chain.join(" → ")}  (${v.why})`);
  process.exit(1);
}
console.log(`check-client-imports: ok — ${clients.length} 'use client' files, no server-only module reachable`);
