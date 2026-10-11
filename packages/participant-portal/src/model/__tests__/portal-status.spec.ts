import { describe, expect, it } from "vitest";
import { derivePortalStatus, statusMessage } from "../portal-status";
import type { StatusInput } from "../portal-status";

const input = (patch: Partial<StatusInput> = {}): StatusInput => ({ phase: "idle", joining: false, failure: null, ...patch });

describe("derivePortalStatus", () => {
  it("接続中は connected、通信が不安定なら reconnecting(入室中の呼び出しがあっても接続を優先)", () => {
    expect(derivePortalStatus(input({ phase: "connected" }))).toBe("connected");
    expect(derivePortalStatus(input({ phase: "connected", joining: true }))).toBe("connected");
    expect(derivePortalStatus(input({ phase: "reconnecting" }))).toBe("reconnecting");
  });

  it("入室の呼び出し中、または何も始まっていない間は joining", () => {
    expect(derivePortalStatus(input({ phase: "joining" }))).toBe("joining");
    expect(derivePortalStatus(input({ phase: "idle", joining: true }))).toBe("joining");
    expect(derivePortalStatus(input())).toBe("joining");
  });

  it("参加できるイベントが無い(SESSION_NOT_FOUND)ときは waiting。それ以外の失敗は error", () => {
    expect(derivePortalStatus(input({ failure: { code: "SESSION_NOT_FOUND", message: "x" } }))).toBe("waiting");
    expect(derivePortalStatus(input({ failure: { code: null, message: "通信できませんでした" } }))).toBe("error");
    expect(derivePortalStatus(input({ failure: { code: "DEVICE_UNAUTHORIZED", message: "x" } }))).toBe("error");
  });

  it("参加していたセッションが終了したら ended(入り直しの呼び出し中は joining)", () => {
    expect(derivePortalStatus(input({ phase: "ended" }))).toBe("ended");
    expect(derivePortalStatus(input({ phase: "ended", joining: true }))).toBe("joining");
  });

  it("認証切れ(unauthorized)で入り直せていなければ error", () => {
    expect(derivePortalStatus(input({ phase: "unauthorized" }))).toBe("error");
  });
});

describe("statusMessage", () => {
  it("状態ごとに案内を返す。error は失敗の内容を出し、無ければ既定の案内", () => {
    expect(statusMessage("waiting", null)).toContain("参加できるイベントはありません");
    expect(statusMessage("ended", null)).toContain("終了");
    expect(statusMessage("error", { code: null, message: "電波の良い場所で" })).toBe("電波の良い場所で");
    expect(statusMessage("error", null)).toBe("接続できませんでした。");
    expect(statusMessage("connected", null)).toBe("接続中");
    expect(statusMessage("reconnecting", null)).toContain("つなぎ直して");
    expect(statusMessage("joining", null)).toContain("接続しています");
  });
});
