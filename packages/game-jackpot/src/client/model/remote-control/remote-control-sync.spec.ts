import { describe, it, expect } from "vitest";
import {
  resolveScreenFromPath,
  shouldNavigateToRemoteScreen,
  shouldFireRemoteAdvance,
} from "./remote-control-sync";

describe("resolveScreenFromPath", () => {
  it("resolves each canonical route to its screen key", () => {
    expect(resolveScreenFromPath("/jackpot-home")).toBe("home");
    expect(resolveScreenFromPath("/jackpot-opening")).toBe("opening");
    expect(resolveScreenFromPath("/jackpot-description")).toBe("description");
    expect(resolveScreenFromPath("/jackpot-demo")).toBe("demo");
    expect(resolveScreenFromPath("/main-draw")).toBe("main-draw");
    expect(resolveScreenFromPath("/jackpot-result")).toBe("result");
    expect(resolveScreenFromPath("/jackpot-ending")).toBe("ending");
  });

  it("resolves the legacy /jackpot-draw path to main-draw as well", () => {
    expect(resolveScreenFromPath("/jackpot-draw")).toBe("main-draw");
  });

  it("returns null for admin routes and unknown paths", () => {
    expect(resolveScreenFromPath("/jackpot-admin/prizes")).toBeNull();
    expect(resolveScreenFromPath("/something-else")).toBeNull();
  });
});

describe("shouldNavigateToRemoteScreen", () => {
  it("never navigates when no remote screen has been set", () => {
    expect(shouldNavigateToRemoteScreen("/jackpot-home", null)).toBe(false);
  });

  it("navigates when the current path does not match the target screen", () => {
    expect(shouldNavigateToRemoteScreen("/jackpot-home", "opening")).toBe(
      true
    );
  });

  it("does not navigate again once already on the target screen", () => {
    expect(shouldNavigateToRemoteScreen("/jackpot-opening", "opening")).toBe(
      false
    );
  });

  it("treats /jackpot-draw as already being on the main-draw screen", () => {
    expect(shouldNavigateToRemoteScreen("/jackpot-draw", "main-draw")).toBe(
      false
    );
  });
});

describe("shouldFireRemoteAdvance", () => {
  it("never fires on the first (baseline) poll, regardless of the seq value", () => {
    expect(shouldFireRemoteAdvance(null, 0)).toBe(false);
    expect(shouldFireRemoteAdvance(null, 5)).toBe(false);
  });

  it("fires when the seq increases from the previously seen value", () => {
    expect(shouldFireRemoteAdvance(3, 4)).toBe(true);
  });

  it("does not fire when the seq is unchanged or somehow decreases", () => {
    expect(shouldFireRemoteAdvance(3, 3)).toBe(false);
    expect(shouldFireRemoteAdvance(3, 2)).toBe(false);
  });
});
