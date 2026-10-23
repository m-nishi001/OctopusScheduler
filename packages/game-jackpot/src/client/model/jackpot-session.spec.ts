import { afterEach, describe, expect, it } from "vitest";
import {
  getJackpotScope,
  resolveJackpotScope,
  setJackpotScope,
} from "./jackpot-session";

describe("jackpot-session", () => {
  afterEach(() => setJackpotScope("live"));

  it("resolves demo only for demo=1", () => {
    expect(resolveJackpotScope({ demo: "1" })).toBe("demo");
    expect(resolveJackpotScope({ demo: "0" })).toBe("live");
    expect(resolveJackpotScope({})).toBe("live");
    expect(resolveJackpotScope(undefined)).toBe("live");
  });

  it("holds the current scope", () => {
    expect(getJackpotScope()).toBe("live");
    setJackpotScope("demo");
    expect(getJackpotScope()).toBe("demo");
  });
});
