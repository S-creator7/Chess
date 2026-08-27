import { describe, expect, it } from "vitest";
import { hashRefreshToken } from "./modules/auth/auth.service";
import { errorBody } from "./lib/errors";

describe("auth helpers", () => {
  it("hashes refresh tokens stably", () => {
    expect(hashRefreshToken("abc")).toBe(hashRefreshToken("abc"));
    expect(hashRefreshToken("abc")).not.toBe(hashRefreshToken("abd"));
  });
});

describe("errors", () => {
  it("uses the API error envelope", () => {
    expect(errorBody("ILLEGAL_MOVE", "Illegal move")).toEqual({
      error: { code: "ILLEGAL_MOVE", message: "Illegal move" },
    });
  });
});
