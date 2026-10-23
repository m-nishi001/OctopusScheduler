import { describe, expect, it } from "vitest";
import { ROUND_KEY_PATTERN } from "../session-types";
import {
  ENTRY_OPTIONS,
  parseDrawPool,
  parseSetPoolPayload,
  MAX_EVENT_TITLE_LENGTH,
  entryRoundKey,
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
    expect(parseEventStartPayload({ title: " 乾杯クイズ " })).toEqual({ title: "乾杯クイズ", pool: "auto" });
    expect(parseEventStartPayload({ title: "x", pool: "entrants" })?.pool).toBe("entrants");
    expect(parseEventStartPayload({ title: "x", pool: "all" })?.pool).toBe("auto");
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

describe("エントリー受付", () => {
  const event = { id: "e1", title: "ジャックポット", startedAtMs: 1_700_000_000_000 };

  it("エントリーの状態を取り出す。無い・形が合わないときはエントリー無しのイベントとして扱う", () => {
    expect(readPortalEvent({ event: { ...event, entry: { key: "entry:e1", open: true } } })?.entry).toEqual({ key: "entry:e1", open: true });
    expect(readPortalEvent({ event: { ...event, entry: { key: "entry:e1", open: false } } })?.entry).toEqual({ key: "entry:e1", open: false });
    for (const entry of [null, "x", {}, { key: "entry:e1" }, { open: true }, { key: "bad key!", open: true }, { key: "entry:e1", open: "yes" }]) {
      const read = readPortalEvent({ event: { ...event, entry } });
      expect(read, JSON.stringify(entry)).toEqual(event);
      expect(read?.entry).toBeUndefined();
    }
  });

  it("エントリーの回答ラウンドの key は、ラウンドの key として有効で、イベントごとに違う", () => {
    expect(ROUND_KEY_PATTERN.test(entryRoundKey("0f4c2d6e-1b2a-4c3d-9e8f-123456789abc"))).toBe(true);
    expect(entryRoundKey("a")).not.toBe(entryRoundKey("b"));
    expect(ROUND_KEY_PATTERN.test(entryRoundKey("x".repeat(500)))).toBe(true);
    expect(ROUND_KEY_PATTERN.test(entryRoundKey("日本語 id/../"))).toBe(true);
  });

  it("エントリーの選択肢は1つだけ", () => {
    expect(ENTRY_OPTIONS).toHaveLength(1);
  });
});

describe("ジャックポットの抽選の対象", () => {
  const event = { id: "e1", title: "ジャックポット", startedAtMs: 1_700_000_000_000 };

  it("イベントから対象を取り出す。省略・不正な値は指定なし（全メンバー）として扱う", () => {
    expect(readPortalEvent({ event: { ...event, pool: "entrants" } })?.pool).toBe("entrants");
    expect(readPortalEvent({ event: { ...event, pool: "auto" } })?.pool).toBe("auto");
    for (const pool of [undefined, null, "", "everyone", 1, {}]) {
      const read = readPortalEvent({ event: { ...event, pool } });
      expect(read, String(pool)).toEqual(event);
      expect(read?.pool).toBeUndefined();
    }
  });

  it("parseDrawPool / parseSetPoolPayload は auto と entrants だけを受け付ける", () => {
    expect(parseDrawPool("auto")).toBe("auto");
    expect(parseDrawPool("entrants")).toBe("entrants");
    for (const v of [undefined, null, "", "all", "ALL", "member", 0]) expect(parseDrawPool(v)).toBeNull();
    expect(parseSetPoolPayload({ mode: "entrants" })).toEqual({ mode: "entrants" });
    for (const p of [null, undefined, {}, { mode: "x" }, "entrants"]) expect(parseSetPoolPayload(p)).toBeNull();
  });
});
