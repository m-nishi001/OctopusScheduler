import { describe, it, expect } from "vitest";
import { createAuthGuard, isSafeRedirect, retryDelayMs, UNVERIFIED, isParticipantPath, isPublicPath, landingPath, resolveLoginRedirect } from "./auth-guard";
import type { SessionCheck } from "./auth-guard";

describe("isPublicPath", () => {
  it.each(["/login"])("%s は公開", (path) => {
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
    // 旧い匿名ポータル。参加者はログインして /p に入る
    "/portal",
    "/portal/ABC234",
    "/p",
    "/p/event",
  ])("%s は要ログイン", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });
});

describe("isParticipantPath", () => {
  it.each(["/p", "/p/", "/p/event/1"])("%s は参加者ポータル", (path) => {
    expect(isParticipantPath(path)).toBe(true);
  });

  it.each(["/", "/home", "/portal", "/portal/ABC234", "/pp", "/profile", "/execute/p"])("%s は参加者ポータルではない", (path) => {
    expect(isParticipantPath(path)).toBe(false);
  });
});

describe("landingPath", () => {
  it("管理者は /home、参加者は /p", () => {
    expect(landingPath("admin")).toBe("/home");
    expect(landingPath("participant")).toBe("/p");
  });
});

describe("resolveLoginRedirect", () => {
  it("管理者は同一アプリ内のどのパスにも戻れる", () => {
    expect(resolveLoginRedirect("admin", "/settings?tab=members")).toBe("/settings?tab=members");
  });

  it("参加者は参加者ポータルにだけ戻れる。それ以外は着地先に落とす", () => {
    expect(resolveLoginRedirect("participant", "/p/event")).toBe("/p/event");
    expect(resolveLoginRedirect("participant", "/p?x=1")).toBe("/p?x=1");
    expect(resolveLoginRedirect("participant", "/settings")).toBe("/p");
    expect(resolveLoginRedirect("participant", "/home?next=/p")).toBe("/p");
  });

  it.each([undefined, null, "", "http://evil.example/", "//evil.example/", "settings", ["/home"]])(
    "不正な戻り先 %s は着地先にする(オープンリダイレクト対策)",
    (redirect) => {
      expect(resolveLoginRedirect("admin", redirect)).toBe("/home");
      expect(resolveLoginRedirect("participant", redirect)).toBe("/p");
    },
  );
});

describe("createAuthGuard", () => {
  const guardFor = (role: SessionCheck) => createAuthGuard({ getRole: async () => role });
  const settings = { path: "/settings", fullPath: "/settings?tab=members" };

  it("旧い匿名ポータル(/portal)も、未ログインならログイン画面へ。参加者は参加者ポータルへ戻される", async () => {
    expect(await guardFor(null)({ path: "/portal/ABC234", fullPath: "/portal/ABC234" })).toEqual({
      path: "/login",
      query: { redirect: "/portal/ABC234" },
    });
    expect(await guardFor("participant")({ path: "/portal", fullPath: "/portal" })).toEqual({ path: "/p" });
  });

  it("未ログインなら入口(/home)も参加者ポータルもログイン画面へ(戻り先付き)", async () => {
    const guard = guardFor(null);
    expect(await guard({ path: "/home", fullPath: "/home" })).toEqual({ path: "/login", query: { redirect: "/home" } });
    expect(await guard({ path: "/p", fullPath: "/p" })).toEqual({ path: "/login", query: { redirect: "/p" } });
    expect(await guard(settings)).toEqual({ path: "/login", query: { redirect: "/settings?tab=members" } });
  });

  it("管理者は管理画面も参加者ポータルも開ける", async () => {
    const guard = guardFor("admin");
    expect(await guard(settings)).toBe(true);
    expect(await guard({ path: "/p", fullPath: "/p" })).toBe(true);
  });

  it("参加者は参加者ポータルだけ開ける。管理画面は参加者ポータルへ戻す", async () => {
    const guard = guardFor("participant");
    expect(await guard({ path: "/p", fullPath: "/p" })).toBe(true);
    expect(await guard({ path: "/p/event", fullPath: "/p/event" })).toBe(true);
    for (const path of ["/home", "/settings", "/sessions", "/session/console/x", "/execute/quiz/q1/play", "/jackpot-admin"]) {
      expect(await guard({ path, fullPath: path })).toEqual({ path: "/p" });
    }
  });

  it("未ログインでもログイン画面は開ける。ログイン済みなら役割ごとの着地先へ", async () => {
    const login = { path: "/login", fullPath: "/login" };
    expect(await guardFor(null)(login)).toBe(true);
    expect(await guardFor("admin")(login)).toEqual({ path: "/home" });
    expect(await guardFor("participant")(login)).toEqual({ path: "/p" });
  });

  it("確認できない(通信エラー等)ときは、保護されたルートへ進ませず接続待ち画面へ送る(戻り先付き)", async () => {
    const guard = guardFor(UNVERIFIED);
    expect(await guard(settings)).toEqual({ path: "/connecting", query: { redirect: "/settings?tab=members" } });
    expect(await guard({ path: "/p", fullPath: "/p" })).toEqual({ path: "/connecting", query: { redirect: "/p" } });
    expect(await guard({ path: "/execute/quiz/q1/play", fullPath: "/execute/quiz/q1/play" })).toEqual({
      path: "/connecting",
      query: { redirect: "/execute/quiz/q1/play" },
    });
  });

  it("確認できなくても、ログイン画面と接続待ち画面そのものは開ける", async () => {
    const guard = guardFor(UNVERIFIED);
    expect(await guard({ path: "/login", fullPath: "/login" })).toBe(true);
    expect(await guard({ path: "/connecting", fullPath: "/connecting?redirect=/home", query: { redirect: "/home" } })).toBe(true);
  });

  it("接続待ち画面: 確認できたら戻り先へ(参加者は参加者ポータルだけ)。未ログインならログイン画面へ", async () => {
    const to = (redirect: unknown) => ({ path: "/connecting", fullPath: "/connecting", query: { redirect } });
    expect(await guardFor("admin")(to("/settings"))).toEqual({ path: "/settings" });
    expect(await guardFor("participant")(to("/settings"))).toEqual({ path: "/p" });
    expect(await guardFor(null)(to("/settings"))).toEqual({ path: "/login", query: { redirect: "/settings" } });
  });

  it.each(["https://example.com", "//example.com", "/\\example.com", "javascript:alert(1)", "/x:y", undefined])(
    "接続待ち画面: 不正な戻り先 %s は外部へ飛ばさない",
    async (redirect) => {
      const to = { path: "/connecting", fullPath: "/connecting", query: { redirect } };
      expect(await guardFor("admin")(to)).toEqual({ path: "/home" });
      expect(await guardFor(null)(to)).toEqual({ path: "/login", query: {} });
    },
  );
});

describe("isSafeRedirect", () => {
  it("アプリ内のパスだけ許可する", () => {
    expect(isSafeRedirect("/home?x=1#a")).toBe(true);
    for (const bad of ["//a.com", "http://a.com", "a", "", null, undefined, ["/a"], "/\\a.com"]) expect(isSafeRedirect(bad)).toBe(false);
  });
});

describe("retryDelayMs", () => {
  it("1→2→4→8→10秒(最大)。10秒を超えず、1秒未満にもならない", () => {
    expect([0, 1, 2, 3, 4, 5, 20].map(retryDelayMs)).toEqual([1000, 2000, 4000, 8000, 10000, 10000, 10000]);
    expect(retryDelayMs(-1)).toBe(1000);
  });
});
