import { canonicalDappOrigin } from "@glyph-oss/connect";

export const GLYPH_ORIGIN_ERROR =
  "Glyph requires a public HTTPS origin. Use an HTTPS deployment or tunnel, and leave NEXT_PUBLIC_APP_ORIGIN blank or set it to that same origin.";

/** Resolve lazily so local browsing and server rendering need no Glyph configuration. */
export function getGlyphAppOrigin() {
  const browserOrigin = typeof window === "undefined" ? undefined : window.location?.origin;
  const configured = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim();
  try {
    const origin = canonicalDappOrigin(configured || browserOrigin || "");
    if (browserOrigin && origin !== canonicalDappOrigin(browserOrigin)) {
      throw new Error("Configured origin does not match this page.");
    }
    return origin;
  } catch {
    // Do not include configuration values, URLs, or credentials in UI errors.
    throw new Error(GLYPH_ORIGIN_ERROR);
  }
}
