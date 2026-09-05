/**
 * Chromium can reject an internal navigation while it hands a custom `glyph:`
 * URL to the operating system. The link launch itself still succeeds, so this
 * exact browser-only rejection must not become an application error.
 */
export function isGlyphLaunchAbort(reason: unknown) {
  if (!reason || typeof reason !== "object") return false;
  const candidate = reason as { name?: unknown; message?: unknown };
  return (
    candidate.name === "AbortError" &&
    candidate.message === "The user aborted a request."
  );
}
