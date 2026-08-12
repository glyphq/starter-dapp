import { afterEach, describe, expect, test } from "bun:test";
import { getGlyphAppOrigin } from "./glyph-origin";

const originalOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN;

afterEach(() => {
  if (originalOrigin === undefined) delete process.env.NEXT_PUBLIC_APP_ORIGIN;
  else process.env.NEXT_PUBLIC_APP_ORIGIN = originalOrigin;
});

describe("Glyph application origin policy", () => {
  test("uses the secure production default and canonicalizes a trailing slash", () => {
    delete process.env.NEXT_PUBLIC_APP_ORIGIN;
    expect(getGlyphAppOrigin()).toBe("https://starter.glyphq.org");

    process.env.NEXT_PUBLIC_APP_ORIGIN = "https://dapp.example/";
    expect(getGlyphAppOrigin()).toBe("https://dapp.example");
  });

  test.each([
    "http://dapp.example",
    "https://user:password@dapp.example",
    "https://dapp.example/path",
    "https://localhost",
    "https://127.0.0.1",
    "https://192.168.1.20",
  ])("rejects an unsafe configured origin: %s", (origin) => {
    process.env.NEXT_PUBLIC_APP_ORIGIN = origin;
    expect(() => getGlyphAppOrigin()).toThrow("credential-free public HTTPS origin");
  });
});
