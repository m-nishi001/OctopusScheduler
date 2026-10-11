import { describe, it, expect, vi } from "vitest";
import { createAdminGuard, isPublicPath } from "./admin-guard";

describe("isPublicPath", () => {
  it.each(["/login", "/portal", "/portal/ABC234"])("%s は公開", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each([
    "/",
    "/home",
    "/settings",
    "/assets",
    "/events",
    "/sessions",
    "/session/host/abc",
    "/session/console/abc",
    "/quiz-admin",
    "/jackpot-admin/members",
    "/execute",
    "/execute/show-image/abc",
    "/execute/jackpot-draw",
    "/execute/quiz/q1/play",
    "/loginx",
    "/portalx",
    "/portal-admin",
  ])("%s は要ログイン", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });
});

describe("createAdminGuard", () => {
  const to = { path: "/settings", fullPath: "/settings?tab=members" };

  it("参加者の入口は確認通信なしで通す", async () => {
    const ensureAdmin = vi.fn(async () => false);
    const guard = createAdminGuard({ ensureAdmin });
    expect(await guard({ path: "/portal/ABC234", fullPath: "/portal/ABC234" })).toBe(true);
    expect(ensureAdmin).not.toHaveBeenCalled();
  });

  it("未ログインなら入口(/home)もログイン画面へ(戻り先付き)", async () => {
    const guard = createAdminGuard({ ensureAdmin: async () => false });
    expect(await guard({ path: "/home", fullPath: "/home" })).toEqual({
      path: "/login",
      query: { redirect: "/home" },
    });
    expect(await guard(to)).toEqual({ path: "/login", query: { redirect: "/settings?tab=members" } });
  });

  it("管理者ログイン済みなら通す", async () => {
    const guard = createAdminGuard({ ensureAdmin: async () => true });
    expect(await guard(to)).toBe(true);
  });

  it("未ログインでもログイン画面は開ける。ログイン済みなら /home へ", async () => {
    const login = { path: "/login", fullPath: "/login" };
    expect(await createAdminGuard({ ensureAdmin: async () => false })(login)).toBe(true);
    expect(await createAdminGuard({ ensureAdmin: async () => true })(login)).toEqual({ path: "/home" });
  });
});
