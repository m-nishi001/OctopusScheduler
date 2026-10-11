import { describe, expect, it } from "vitest";
import {
  MAX_EVENT_TITLE_LENGTH,
  normalizeEventTitle,
  parseEventStartPayload,
  readPortalEvent,
} from "../portal-event";

describe("normalizeEventTitle", () => {
  it("前後の空白を除き、連続する空白を1つにする", () => {
    expect(normalizeEventTitle("  ジャックポット \n 抽選  ")).toBe("ジャックポット 抽選");
  });

  it("上限の長さで切る", () => {
    expect(normalizeEventTitle("あ".repeat(MAX_EVENT_TITLE_LENGTH + 20))).toHaveLength(MAX_EVENT_TITLE_LENGTH);
  });

  it.each([undefined, null, "", "   ", 123, {}, []])("空や文字列でない値 %s は null", (value) => {
    expect(normalizeEventTitle(value)).toBeNull();
  });
});

describe("parseEventStartPayload", () => {
  it("タイトルがあれば整えて返す", () => {
    expect(parseEventStartPayload({ title: " 乾杯クイズ " })).toEqual({ title: "乾杯クイズ" });
  });

  it.each([null, undefined, {}, { title: "" }, { title: 1 }, "x"])("不正なペイロード %s は null", (payload) => {
    expect(parseEventStartPayload(payload)).toBeNull();
  });
});

describe("readPortalEvent", () => {
  const event = { id: "e1", title: "ジャックポット", startedAtMs: 1_700_000_000_000 };

  it("公開された状態からイベントを取り出す", () => {
    expect(readPortalEvent({ event })).toEqual(event);
  });

  it("イベントが無い・状態が無いときは null", () => {
    expect(readPortalEvent({})).toBeNull();
    expect(readPortalEvent(null)).toBeNull();
    expect(readPortalEvent(undefined)).toBeNull();
  });

  it.each([
    ["文字列", "event"],
    ["idなし", { title: "x", startedAtMs: 1 }],
    ["idが空", { id: "", title: "x", startedAtMs: 1 }],
    ["titleなし", { id: "e", startedAtMs: 1 }],
    ["startedAtMsが数値でない", { id: "e", title: "x", startedAtMs: "1" }],
  ])("形が合わない状態(%s)はイベント無しとして扱う", (_name, value) => {
    expect(readPortalEvent({ event: value })).toBeNull();
  });
});
