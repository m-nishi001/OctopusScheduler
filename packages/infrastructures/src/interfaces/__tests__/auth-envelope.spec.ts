import { describe, it, expect } from "vitest";
import { unwrapAuth, wrapWithAuth } from "../auth-envelope";

describe("auth envelope", () => {
  it("does not wrap when there is no token", () => {
    const args = { a: 1 };
    expect(wrapWithAuth(null, args)).toBe(args);
    expect(wrapWithAuth(undefined, "x")).toBe("x");
  });

  it("round-trips object, string and undefined args", () => {
    for (const args of [{ a: 1 }, "screen", undefined, 0]) {
      expect(unwrapAuth(wrapWithAuth("tok", args))).toEqual({ token: "tok", args });
    }
  });

  it("treats unwrapped input as having no token", () => {
    expect(unwrapAuth({ a: 1 })).toEqual({ token: null, args: { a: 1 } });
    expect(unwrapAuth(undefined)).toEqual({ token: null, args: undefined });
    expect(unwrapAuth(null)).toEqual({ token: null, args: null });
  });

  it("ignores a non-string token marker", () => {
    const raw = { __octopusAuth: 123, args: "x" };
    expect(unwrapAuth(raw)).toEqual({ token: null, args: raw });
  });
});
