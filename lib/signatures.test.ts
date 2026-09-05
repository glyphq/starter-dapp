import { describe, expect, test } from "bun:test";
import { signatureBytes, validateSignatureInputs } from "./signatures";

describe("signature input validation", () => {
  test("rejects blank messages before signature validation", () => {
    expect(validateSignatureInputs(" \n\t", "bad")).toBe("Enter a message.");
    expect(validateSignatureInputs("hello")).toBeNull();
    expect(validateSignatureInputs(" hello ")).toBeNull();
  });

  test("requires exactly 64 bytes of plain hex", () => {
    for (const invalid of [
      "",
      "ab",
      "a".repeat(127),
      "a".repeat(129),
      "gg".repeat(64),
      `0x${"ab".repeat(64)}`,
      ` ${"ab".repeat(64)}`,
    ]) {
      expect(validateSignatureInputs("hello", invalid)).not.toBeNull();
      expect(() => signatureBytes(invalid)).toThrow("Invalid signature hex.");
    }
    expect(validateSignatureInputs("hello", "aB".repeat(64))).toBeNull();
  });

  test("decodes mixed-case hex without altering bytes", () => {
    expect(signatureBytes("aB".repeat(64))).toEqual(
      new Uint8Array(64).fill(171),
    );
  });
});
