// 410 Gone handler for quarantined US-state paths (TDL US-cleanup 2026-05-06).
// Reached via next.config.js rewrites that map /<us-state-code>(/...) here.
// Replaces the implicit 404 the legacy [region] dynamic route would produce
// for unknown slugs, so Google can de-index US listing URLs faster.
export async function GET() {
  const body = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<title>Page Gone</title>
</head>
<body>
<h1>This page is no longer available.</h1>
<p>The directory has moved to Canadian listings only.</p>
</body>
</html>`;
  return new Response(body, {
    status: 410,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
