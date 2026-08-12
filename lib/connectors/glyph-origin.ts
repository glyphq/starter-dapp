const DEFAULT_GLYPH_APP_ORIGIN = "https://starter.glyphq.org";

function isNonGlobalIpv4(host: string) {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const octets = parts.map(Number);
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;

  const [a = 0, b = 0, c = 0, d = 0] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    (a >= 224 && a <= 255) ||
    (a === 255 && b === 255 && c === 255 && d === 255)
  );
}

function isNonGlobalHost(host: string) {
  const normalized = host.replace(/^\[(.*)\]$/, "$1").toLowerCase();
  if (normalized === "localhost" || isNonGlobalIpv4(normalized)) return true;
  if (!normalized.includes(":")) return false;

  const mappedIpv4 = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mappedIpv4?.[1] && isNonGlobalIpv4(mappedIpv4[1])) return true;

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:") ||
    normalized === "2001:db8::1"
  );
}

/**
 * Return the one origin bound into Glyph requests and connector metadata.
 *
 * This intentionally rejects development origins, credentials, paths, and
 * non-global hosts. The SDK validates the same policy when building requests,
 * but enforcing it here keeps metadata and request construction consistent.
 */
export function getGlyphAppOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim() || DEFAULT_GLYPH_APP_ORIGIN;
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("NEXT_PUBLIC_APP_ORIGIN must be a credential-free public HTTPS origin.");
  }

  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== "" ||
    isNonGlobalHost(url.hostname)
  ) {
    throw new Error("NEXT_PUBLIC_APP_ORIGIN must be a credential-free public HTTPS origin.");
  }

  return url.origin;
}
