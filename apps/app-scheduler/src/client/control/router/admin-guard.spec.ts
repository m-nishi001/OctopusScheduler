import { describe, it, expect, vi } from "vitest";
import { createAdminGuard, requiresAdmin } from "./admin-guard";

describe("requiresAdmin", () => {
  it.each([
    "/settings",
    "/assets",
    "/events",
    "/quiz-admin",
    "/quiz-admin/quizzes",
    "/jackpot-admin/members",
    "/execute/quiz-admin/members",
    "/execute/jackpot-admin/prizes",
    "/sessions",
    "/session/host/abc",
    "/session/console/abc",
  ])("%s は管理画面", (path) => {
    expect(requiresAdmin(path)).toBe(true);
  });

  it.each([
    "/",
    "/home",
    "/login",
    "/execute",
    "/execute/show-image/abc",
    "/execute/jackpot-draw",
    "/execute/quiz/q1/play",
    "/execute/quiz/q1/result",
    "/quiz/q1/join",
    "/settingsfoo",
    "/quiz-administrators",
    "/portal",
    "/portal/ABC234",
    "/sessionsfoo",
    "/session/other",
  ])("%s は公開", (path) => {
    expect(requiresAdmin(path)).toBe(false);
  });
});

describe("createAdminGuard", () => {
  const to = { path: "/settings", fullPath: "/settings?tab=members" };

  it("開発モードでは未ログインでも通す(確認もしない)", async () => {
    const ensureAdmin = vi.fn(async () => false);
    const guard = createAdminGuard({ isProduction: () => false, ensureAdmin });
    expect(await guard(to)).toBe(true);
    expect(ensureAdmin).not.toHaveBeenCalled();
  });

  it("本番モードでも公開ルートは通す", async () => {
    const ensureAdmin = vi.fn(async () => false);
    const guard = createAdminGuard({ isProduction: () => true, ensureAdmin });
    expect(await guard({ path: "/quiz/q1/join", fullPath: "/quiz/q1/join" })).toBe(true);
    expect(ensureAdmin).not.toHaveBeenCalled();
  });

  it("本番モードで未ログインならログイン画面へ(戻り先付き)", async () => {
    const guard = createAdminGuard({ isProduction: () => true, ensureAdmin: async () => false });
    expect(await guard(to)).toEqual({ path: "/login", query: { redirect: "/settings?tab=members" } });
  });

  it("本番モードで管理者ログイン済みなら通す", async () => {
    const guard = createAdminGuard({ isProduction: () => true, ensureAdmin: async () => true });
    expect(await guard(to)).toBe(true);
  });
});
