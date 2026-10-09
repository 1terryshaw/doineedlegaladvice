// leads-plus-canary-v1 — owner share kit: a QR code for the listing's EXISTING URL, as PNG or a
// one-page printable PDF. Owner-authenticated, Leads Plus only. No new dependency: QR via `uqr`
// (already in package.json), raster via `sharp`, PDF hand-assembled (one page, one JPEG, Helvetica).
import { NextRequest, NextResponse } from "next/server";
import { renderSVG } from "uqr";
import sharp from "sharp";
import { verifyOwnerAccess } from "@/lib/auth";
import { hasLeadsPlus } from "@/lib/leads-plus";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

function shareUrl(slug: string) {
  return `${SITE_URL}/directory/${slug}?utm_source=owner_share&utm_medium=qr`;
}

const pdfText = (s: string, max = 90) => s.replace(/[^\x20-\x7e]/g, "").replace(/([()\\])/g, "\\$1").slice(0, max);

function buildPdf(jpeg: Buffer, size: number, title: string, line: string): Buffer {
  const content =
    `BT /F1 22 Tf 72 720 Td (${pdfText(title)}) Tj ET\n` +
    `BT /F1 13 Tf 72 696 Td (Scan to see our page, get a quote or contact us.) Tj ET\n` +
    `q 324 0 0 324 144 330 cm /Im0 Do Q\n` +
    `BT /F1 9 Tf 72 300 Td (${pdfText(line, 140)}) Tj ET\n`;
  const objs: (string | Buffer)[] = [];
  objs.push("<< /Type /Catalog /Pages 2 0 R >>");
  objs.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objs.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 4 0 R >> /Font << /F1 6 0 R >> >> /Contents 5 0 R >>");
  objs.push(Buffer.concat([
    Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${size} /Height ${size} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
    jpeg,
    Buffer.from("\nendstream"),
  ]));
  objs.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`);
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
  const offsets: number[] = [];
  let len = parts[0].length;
  objs.forEach((o, i) => {
    offsets.push(len);
    const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), typeof o === "string" ? Buffer.from(o) : o, Buffer.from("\nendobj\n")]);
    parts.push(b);
    len += b.length;
  });
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${len}\n%%EOF\n`;
  parts.push(Buffer.from(xref));
  return Buffer.concat(parts);
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const format = req.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "png";
  const access = slug ? await verifyOwnerAccess(slug) : null;
  const l = access?.listing;
  if (!l) return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  if (!hasLeadsPlus(l) || l.leads_plus_enabled !== true) return NextResponse.json({ error: "Leads Plus is not active" }, { status: 403 });

  const url = shareUrl(slug);
  const svg = renderSVG(url, { border: 2, ecc: "M" });
  const size = 900;
  if (format === "png") {
    const png = await sharp(Buffer.from(svg)).resize(size, size, { kernel: "nearest" }).png().toBuffer();
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${slug}-qr.png"`, "Cache-Control": "private, no-store" },
    });
  }
  const jpeg = await sharp(Buffer.from(svg)).resize(size, size, { kernel: "nearest" }).flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer();
  const pdf = buildPdf(jpeg, size, String(l.name || slug), `${SITE_URL}/directory/${slug}`);
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${slug}-qr.pdf"`, "Cache-Control": "private, no-store" },
  });
}
