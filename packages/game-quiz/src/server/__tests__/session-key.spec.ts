import { describe, it, expect } from "vitest";
import { sessionKey } from "../session-key";

describe("sessionKey", () => {
  it("separates live and demo keys of the same quiz", () => {
    expect(sessionKey("p", "q1", "live")).toBe("p/q1:live");
    expect(sessionKey("p", "q1", "demo")).toBe("p/q1:demo");
  });

  it("rejects an unknown scope", () => {
    expect(() => sessionKey("p", "q1", "other" as never)).toThrow();
    expect(() => sessionKey("p", "q1", undefined as never)).toThrow();
  });
});
