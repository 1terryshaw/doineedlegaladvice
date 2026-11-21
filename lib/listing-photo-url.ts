/** Only resolved web URLs and same-origin paths may become listing image sources. */
export function listingPhotoUrl(value: string | null | undefined): string | null {
  const url = value?.trim();
  if (!url || /[\\\u0000-\u001f\u007f]/.test(url)) return null;
  if (/^\/(?!\/)/.test(url)) return url;
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const parsed = new URL(url);
    return parsed.hostname ? url : null;
  } catch {
    return null;
  }
}
