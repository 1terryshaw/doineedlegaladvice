// owner-canary-fixes-and-review-kit-v1 (fanned by owner-nextstep-kit-fleet-fan-v1) — contact rule for
// owner-facing pages: /contact when that route returns 200 on THIS site, else the site's footer contact email.
// The route check is a live HTTP probe run when the page is stamped onto a site, never a guess:
//   curl -s -o /dev/null -w '%{http_code}' https://<site>/contact     (200 -> true, else false)
// doineedlegaladvice.com, probed 2026-09-26: /contact -> 200; footer shows NO contact email; supportEmail domain has no MX (undeliverable), so the canary's own deliverable mailbox terry@doineedapro.com is used (flagged for ruling).
export const CONTACT_PAGE_OK = true;

const FOOTER_EMAIL = "terry@doineedapro.com";

export function contactHref(pageOk: boolean = CONTACT_PAGE_OK, footerEmail: string = FOOTER_EMAIL): string | null {
  if (pageOk) return "/contact";
  return footerEmail ? `mailto:${footerEmail}` : null;
}
