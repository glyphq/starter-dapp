import { afterEach, describe, expect, test } from "bun:test";
import { getGlyphAppOrigin, GLYPH_ORIGIN_ERROR } from "./glyph-origin";

const originalOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

function setBrowserOrigin(origin?: string) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: origin === undefined ? undefined : { location: { origin } },
  });
}

afterEach(() => {
  if (originalOrigin === undefined) delete process.env.NEXT_PUBLIC_APP_ORIGIN;
  else process.env.NEXT_PUBLIC_APP_ORIGIN = originalOrigin;
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

describe("Glyph application origin policy", () => {
  test.each([undefined, "", "  "])("uses the page origin with no override: %s", (configured) => {
    if (configured === undefined) delete process.env.NEXT_PUBLIC_APP_ORIGIN;
    else process.env.NEXT_PUBLIC_APP_ORIGIN = configured;
    setBrowserOrigin("https://my-app.example");
    expect(getGlyphAppOrigin()).toBe("https://my-app.example");
  });

  test("canonicalizes a matching override", () => {
    setBrowserOrigin("https://dapp.example");
    process.env.NEXT_PUBLIC_APP_ORIGIN = " https://DAPP.example:443/ ";
    expect(getGlyphAppOrigin()).toBe("https://dapp.example");
  });

  test("rejects a different deployment identity", () => {
    setBrowserOrigin("https://my-app.example");
    process.env.NEXT_PUBLIC_APP_ORIGIN = "https://starter.glyphq.org";
    expect(() => getGlyphAppOrigin()).toThrow(GLYPH_ORIGIN_ERROR);
  });

  test("does not invent an origin outside the browser", () => {
    setBrowserOrigin();
    delete process.env.NEXT_PUBLIC_APP_ORIGIN;
    expect(() => getGlyphAppOrigin()).toThrow(GLYPH_ORIGIN_ERROR);
    process.env.NEXT_PUBLIC_APP_ORIGIN = "https://dapp.example/";
    expect(getGlyphAppOrigin()).toBe("https://dapp.example");
  });

  test.each([
    "not a URL",
    "http://dapp.example",
    "https://user:password@dapp.example",
    "https://dapp.example/path",
    "https://dapp.example?token=secret",
    "https://dapp.example#fragment",
    "https://localhost",
    "https://127.0.0.1",
    "https://192.168.1.20",
    "https://[::1]",
    "https://[::ffff:127.0.0.1]",
  ])("rejects unsafe overrides without exposing their values: %s", (origin) => {
    setBrowserOrigin();
    process.env.NEXT_PUBLIC_APP_ORIGIN = origin;
    expect(() => getGlyphAppOrigin()).toThrow(GLYPH_ORIGIN_ERROR);
  });

  test.each(["http://localhost:3000", "https://127.0.0.1"])("rejects unsafe page origins: %s", (origin) => {
    setBrowserOrigin(origin);
    delete process.env.NEXT_PUBLIC_APP_ORIGIN;
    expect(() => getGlyphAppOrigin()).toThrow(GLYPH_ORIGIN_ERROR);
    process.env.NEXT_PUBLIC_APP_ORIGIN = "https://dapp.example";
    expect(() => getGlyphAppOrigin()).toThrow(GLYPH_ORIGIN_ERROR);
  });
});
