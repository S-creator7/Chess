import { describe, expect, it } from "vitest";

function sanitize(body: string) {
  return body.replace(/\s+/g, " ").trim().slice(0, 240);
}

describe("chat sanitize", () => {
  it("trims and collapses whitespace", () => {
    expect(sanitize("  hello   world  ")).toBe("hello world");
  });
  it("rejects empty after trim", () => {
    expect(sanitize("   ")).toBe("");
  });
});
