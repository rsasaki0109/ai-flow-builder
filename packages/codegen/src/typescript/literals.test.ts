import { describe, expect, it } from "vitest";
import {
  isSafeIdentifierName,
  isTypeScriptReservedWord,
  toTypeScriptPropertyKey,
  toTypeScriptStringLiteral,
} from "../index.js";

describe("TypeScript literal helpers", () => {
  it("escapes strings as JSON-compatible TypeScript literals", () => {
    const value = 'Line 1\n"quoted" \\ path\tend';
    const literal = toTypeScriptStringLiteral(value);

    expect(literal).toBe('"Line 1\\n\\"quoted\\" \\\\ path\\tend"');
    expect(JSON.parse(literal)).toBe(value);
  });

  it("preserves non-ASCII text while producing a parseable literal", () => {
    const value = "要約結果: こんにちは";
    const literal = toTypeScriptStringLiteral(value);

    expect(JSON.parse(literal)).toBe(value);
  });

  it("escapes JavaScript line and paragraph separators", () => {
    const value = `a${String.fromCodePoint(0x2028)}b${String.fromCodePoint(
      0x2029,
    )}c`;
    const literal = toTypeScriptStringLiteral(value);

    expect(literal).toContain("\\u2028");
    expect(literal).toContain("\\u2029");
    expect(JSON.parse(literal)).toBe(value);
  });

  it("uses bare property keys only for safe non-reserved identifiers", () => {
    expect(toTypeScriptPropertyKey("result")).toBe("result");
    expect(toTypeScriptPropertyKey("result-key")).toBe('"result-key"');
    expect(toTypeScriptPropertyKey("class")).toBe('"class"');
  });

  it("classifies identifier names and reserved words", () => {
    expect(isSafeIdentifierName("flowOutput")).toBe(true);
    expect(isSafeIdentifierName("2flowOutput")).toBe(false);
    expect(isSafeIdentifierName("flow-output")).toBe(false);
    expect(isSafeIdentifierName("class")).toBe(false);
    expect(isTypeScriptReservedWord("class")).toBe(true);
    expect(isTypeScriptReservedWord("flowOutput")).toBe(false);
  });
});
