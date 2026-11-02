import { describe, expect, it } from "vitest";
import { StorageKind, StorageModule, storageNamespace } from "@octopus/infrastructures/compositions";
import { exportTable, parseTable, planImport } from "@octopus/table-io";
import type { AppEvent } from "../app-event/app-event";
import { eventAdapter, eventAssets, formatEventDateTime, parseEventDateTime } from "./event-table";
import type { EventAssetEntry } from "./event-table";

const STORE = storageNamespace(StorageModule.Scheduler, StorageKind.Assets);
const entries: EventAssetEntry[] = [
  { id: "a-bgm", name: "bgm.wav", mime: "audio/wav" },
  { id: "a-pic", name: "pic.png", mime: "image/png" },
  { id: "a-mov", name: "clip.mp4", mime: "video/mp4" },
  { id: "a-s1", name: "s1.png", mime: "image/png", directoryId: `${STORE}/slides` },
];
const assets = eventAssets(entries);
const NOW = new Date(2026, 0, 1, 0, 0, 0);
const adapter = (a = assets) => eventAdapter(a, () => NOW);
const HEADER = "ID,種別,開始,終了,素材,表示,フォルダ,切替秒,切替効果,フェードアウト秒,遷移先URL\n";
const rowsOf = (csv: string) => {
  const parsed = parseTable(new TextEncoder().encode(csv), adapter().headers);
  if (!parsed.ok) throw new Error(parsed.errors.join());
  return parsed.rows;
};
const at = (h: number, m = 0) => new Date(2026, 10, 2, h, m);
const timing = { processedAt: null, registeredAt: new Date(2026, 5, 5), updatedAt: new Date(2026, 5, 5) };
const events: AppEvent[] = [
  { id: "e-audio", type: "AudioEvent", startTime: at(9), endTime: at(10), audioId: "a-bgm", fadeOutSec: 2.5, ...timing },
  { id: "e-image", type: "ScreenEvent", startTime: at(10), endTime: at(11), spec: { kind: "image", id: "a-pic" }, ...timing },
  { id: "e-video", type: "ScreenEvent", startTime: at(11), endTime: at(12), spec: { kind: "video", id: "a-mov" }, ...timing },
  { id: "e-show", type: "ScreenEvent", startTime: at(12), endTime: at(13), spec: { kind: "slideshow", folder: "slides", intervalSec: 7, transition: "slide" }, ...timing },
  { id: "e-page", type: "TransitionPageEvent", startTime: at(13), endTime: at(14), transitionUrl: "/quiz/q1/intro", fadeOutDuration: 1, ...timing },
];
const plan = (csv: string, mode: "upsert" | "replace" = "upsert", current: AppEvent[] = events, a = assets, changed: string[] = []) =>
  planImport(current, rowsOf(csv), adapter(a), mode, new Set(changed));

describe("日時", () => {
  it("書くのは YYYY-MM-DD HH:mm(ローカル時刻)", () => {
    expect(formatEventDateTime(new Date(2026, 10, 2, 9, 5))).toBe("2026-11-02 09:05");
  });

  it("/ 区切り・秒つき・T 区切り・日付だけ・全角も読める", () => {
    const local = new Date(2026, 10, 2, 9, 5, 0);
    for (const s of ["2026-11-02 09:05", "2026/11/2 9:05", "2026-11-02T09:05", "2026-11-02 09:05:00", "２０２６/１１/０２ ９:０５"]) {
      expect(parseEventDateTime(s)?.getTime(), s).toBe(local.getTime());
    }
    expect(parseEventDateTime("2026-11-02")?.getTime()).toBe(new Date(2026, 10, 2).getTime());
    expect(parseEventDateTime("2026-11-02 09:05:30")?.getSeconds()).toBe(30);
  });

  it("時差つき(ISO)は、その時刻として読む", () => {
    expect(parseEventDateTime("2026-11-02T00:00:00Z")?.toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(parseEventDateTime("2026-11-02T09:00:00+09:00")?.toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(parseEventDateTime("2026-11-02 09:00+0900")?.toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });

  it("読めない・実在しない日時は null", () => {
    for (const s of ["", "明日", "2026-13-01 00:00", "2026-02-30 00:00", "2026-11-02 25:00", "11/2 9:00"]) expect(parseEventDateTime(s), s).toBeNull();
  });
});

describe("往復", () => {
  it("3種類すべて(画像・動画・スライドショー含む)、書き出してそのまま取り込むと全行が変更なし(置き換えでも)", () => {
    const csv = exportTable(events, adapter());
    expect(csv).toContain("e-show,スクリーン,2026-11-02 12:00,2026-11-02 13:00,,スライドショー,slides,7,スライド,,");
    expect(csv).toContain("e-audio,音楽,2026-11-02 09:00,2026-11-02 10:00,bgm.wav,,,,,2.5,");
    const p = plan(csv, "replace");
    expect(p.ok).toBe(true);
    expect(p.counts).toEqual({ add: 0, update: 0, unchanged: 5, delete: 0, error: 0 });
  });

  it("英語の見出しと英語の種別でも読める", () => {
    const p = plan("id,type,start,end,media\nn1,audio,2026/11/02 9:00,2026/11/02 9:30,bgm.wav\n");
    expect(p.rows[0]).toMatchObject({ status: "add", key: "n1" });
    expect(p.upserts[0]).toMatchObject({ type: "AudioEvent", audioId: "a-bgm", fadeOutSec: 0 });
  });
});

describe("種別ごとの必須の列", () => {
  const errors = (csv: string) => plan(HEADER + csv).rows.map((r) => r.message);

  it("音楽: 素材が必須(音声であること)。フェードアウトは0以上", () => {
    expect(errors("n1,音楽,2026-11-02 09:00,2026-11-02 10:00,,,,,,,\n")).toEqual(["音源は必須です"]);
    expect(errors("n1,音楽,2026-11-02 09:00,2026-11-02 10:00,pic.png,,,,,,\n")).toEqual(["音源「pic.png」は音声ではありません"]);
    expect(errors("n1,音楽,2026-11-02 09:00,2026-11-02 10:00,bgm.wav,,,,,-1,\n")).toEqual([expect.stringContaining("フェードアウト秒")]);
  });

  it("スクリーン: 表示が必須。画像・動画は素材、スライドショーはフォルダ(切替秒は1〜3600)", () => {
    const t = "n1,スクリーン,2026-11-02 09:00,2026-11-02 10:00";
    expect(errors(`${t},,,,,,,\n`)).toEqual(["表示が空です"]);
    expect(errors(`${t},,画像,,,,,\n`)).toEqual(["画像は必須です"]);
    expect(errors(`${t},clip.mp4,画像,,,,,\n`)).toEqual(["画像「clip.mp4」は画像ではありません"]);
    expect(errors(`${t},,スライドショー,,,,,\n`)).toEqual(["フォルダが空です"]);
    expect(errors(`${t},,スライドショー,none,,,,\n`)).toEqual([expect.stringContaining("フォルダ「none」が見つかりません")]);
    expect(errors(`${t},,スライドショー,slides,0,,,\n`)).toEqual([expect.stringContaining("切替秒")]);
    expect(errors(`${t},,スライドショー,slides,3601,,,\n`)).toEqual([expect.stringContaining("切替秒")]);
    expect(errors(`${t},,スライドショー,slides,3,回転,,\n`)).toEqual([expect.stringContaining("切替効果")]);
    expect(errors(`${t},,スライドショー,slides,3,,,\n`)).toEqual([undefined]);
  });

  it("ページ遷移: 遷移先URLが必須", () => {
    expect(errors("n1,ページ遷移,2026-11-02 09:00,2026-11-02 10:00,,,,,,,\n")).toEqual(["遷移先URLが空です"]);
  });

  it("種別を使わない列は無視する(音楽の行の表示・フォルダ・URLは読まない)", () => {
    const p = plan(HEADER + "n1,音楽,2026-11-02 09:00,2026-11-02 10:00,bgm.wav,動画,nowhere,999,回転,3,/x\n");
    expect(p.ok).toBe(true);
    expect(p.upserts[0]).toMatchObject({ type: "AudioEvent", audioId: "a-bgm", fadeOutSec: 3 });
  });

  it("種別・開始・終了の列が無いファイルは読めない", () => {
    expect(parseTable(new TextEncoder().encode("ID,開始,終了\n"), adapter().headers)).toMatchObject({ ok: false });
  });
});

describe("時刻の検査", () => {
  const msgs = (csv: string) => plan(HEADER + csv).rows.map((r) => r.message);

  it("開始と終了が空・読めない・開始が終了以降はエラー", () => {
    expect(msgs("n1,音楽,,2026-11-02 10:00,bgm.wav,,,,,,\n")).toEqual(["開始が空です"]);
    expect(msgs("n1,音楽,2026-11-02 09:00,,bgm.wav,,,,,,\n")).toEqual(["終了が空です"]);
    expect(msgs("n1,音楽,あした,2026-11-02 10:00,bgm.wav,,,,,,\n")).toEqual(["開始の日時を読めません: あした"]);
    expect(msgs("n1,音楽,2026-11-02 10:00,2026-11-02 10:00,bgm.wav,,,,,,\n")).toEqual([expect.stringContaining("開始が終了より後")]);
    expect(msgs("n1,音楽,2026-11-02 11:00,2026-11-02 10:00,bgm.wav,,,,,,\n")).toEqual([expect.stringContaining("開始が終了より後")]);
    expect(msgs("n1,オルガン,2026-11-02 09:00,2026-11-02 10:00,bgm.wav,,,,,,\n")).toEqual([expect.stringContaining("種別は")]);
  });
});

describe("既存のイベントの更新", () => {
  it("処理済み日時・登録日時は残し、更新日時だけ変わる。空の列はいまのまま、ID が空なら新規で採番する", () => {
    const current: AppEvent[] = [{ ...events[0], processedAt: at(9, 30) }];
    const p = plan(HEADER + "e-audio,音楽,2026-11-02 09:00,2026-11-02 10:30,,,,,,,\n,ページ遷移,2026-11-02 09:00,2026-11-02 10:00,,,,,,,/x\n", "upsert", current);
    expect(p.rows.map((r) => r.status)).toEqual(["update", "add"]);
    expect(p.upserts[0]).toMatchObject({ id: "e-audio", audioId: "a-bgm", fadeOutSec: 2.5, processedAt: at(9, 30), registeredAt: timing.registeredAt, updatedAt: NOW, endTime: at(10, 30) });
    expect(p.upserts[1].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(p.upserts[1]).toMatchObject({ registeredAt: NOW, processedAt: null });
  });

  it("置き換えは、ファイルに無いイベントを削除する(素材のことは知らない)", () => {
    const p = plan(HEADER + "e-page,ページ遷移,2026-11-02 13:00,2026-11-02 14:00,,,,,,1,/quiz/q1/intro\n", "replace");
    expect(p.rows.filter((r) => r.status === "delete").map((r) => r.key)).toEqual(["e-audio", "e-image", "e-video", "e-show"]);
    expect(p.deletes).toHaveLength(4);
  });
});

describe("素材の引き当て", () => {
  const row = "n1,音楽,2026-11-02 09:00,2026-11-02 10:00,";

  it("一覧にある名前は、その素材の id を参照する(フォルダ名つきのパスでもファイル名で引く)", () => {
    const p = plan(HEADER + `${row}dir/bgm.wav,,,,,,\n`);
    expect(p.upserts[0]).toMatchObject({ audioId: "a-bgm" });
  });

  it("一覧にも選んだファイルにも無い名前はエラー", () => {
    expect(plan(HEADER + `${row}none.wav,,,,,,\n`).rows[0].message).toBe("音源「none.wav」が見つかりません");
  });

  it("同じ名前の素材が一覧に複数あるとエラー(その素材を使う行だけ)", () => {
    const dup = eventAssets([...entries, { id: "a-bgm2", name: "bgm.wav", mime: "audio/wav" }]);
    const p = plan(HEADER + `${row}bgm.wav,,,,,,\nn2,ページ遷移,2026-11-02 09:00,2026-11-02 10:00,,,,,,,/x\n`, "upsert", [], dup);
    expect(p.rows.map((r) => r.message)).toEqual(["同名の素材が複数あります: bgm.wav", undefined]);
    expect(p.ok).toBe(false);
  });

  it("差し替える素材を使う行は、文字列が同じでも更新になる", () => {
    const csv = exportTable(events, adapter());
    const p = plan(csv, "upsert", events, assets, ["pic.png", "bgm.wav"]);
    expect(p.rows.filter((r) => r.status === "update").map((r) => r.key)).toEqual(["e-audio", "e-image"]);
  });

  it("素材のセルの - は素材を外す(音楽・画像・動画は素材が必要なのでエラー)", () => {
    expect(plan(HEADER + `${row}-,,,,,,\n`).rows[0].message).toBe("音源は必須です");
  });
});
