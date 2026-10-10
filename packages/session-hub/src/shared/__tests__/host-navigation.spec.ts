import { describe, expect, it } from "vitest";
import { buildPortalUrl, isAllowedHostPath, lobbyPath } from "../host-navigation";

describe("isAllowedHostPath", () => {
  it.each([
    "/session/host/abc-123",
    "/jackpot-opening",
    "/execute/jackpot-draw",
    "/jackpot-ending?demo=1",
    "/quiz/q1/intro",
    "/execute/quiz/q1/play",
    "/execute/show-image/asset1",
  ])("許可: %s", (p) => expect(isAllowedHostPath(p)).toBe(true));

  it.each([
    "/settings",
    "/assets",
    "/events",
    "/login",
    "/jackpot-admin",
    "/execute/jackpot-admin/members",
    "/quiz-admin/quizzes",
    "/quiz/q1/join",
    "/quiz/q1/intro/preview",
    "https://evil.example/",
    "//evil.example/",
    "/jackpot-opening#/settings",
    "/jackpot-opening?redirect=/settings",
    "/jackpot-opening?demo=1&x=1",
    "/jackpot-opening?demo=1?x",
    "/quiz//intro",
    "/quiz/a b/intro",
    "/session/host/",
    "/session/host/../settings",
    "",
    "/jackpot-opening ",
  ])("拒否: %j", (p) => expect(isAllowedHostPath(p)).toBe(false));

  it("文字列以外・長すぎる値は拒否", () => {
    expect(isAllowedHostPath(undefined)).toBe(false);
    expect(isAllowedHostPath(null)).toBe(false);
    expect(isAllowedHostPath(42)).toBe(false);
    expect(isAllowedHostPath({ path: "/jackpot-opening" })).toBe(false);
    expect(isAllowedHostPath(`/quiz/${"a".repeat(400)}/intro`)).toBe(false);
  });

  it("lobbyPath は常に許可される", () => {
    expect(isAllowedHostPath(lobbyPath("0a1b2c3d-4e5f"))).toBe(true);
  });
});

describe("buildPortalUrl", () => {
  it("既存のハッシュを取り除いてポータルのハッシュを付ける", () => {
    expect(buildPortalUrl("ABC234", "https://example.com/app/exec#/home")).toBe("https://example.com/app/exec#/portal/ABC234");
  });
});
