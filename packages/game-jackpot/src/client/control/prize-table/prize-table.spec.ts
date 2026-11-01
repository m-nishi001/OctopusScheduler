import { describe, expect, it } from "vitest";
import { exportTable, parseTable, planImport } from "@octopus/table-io";
import type { ImportMode } from "@octopus/table-io";
import type { Prize } from "../../../server/jackpot-api-contract";
import { orderImportedPrizes, PRIZE_HEADERS, prizeAdapter } from "./prize-table";

const prize = (id: string, extra: Partial<Prize> = {}): Prize => ({ id, name: `景品${id}`, order: 1, ...extra });
const plan = (current: Prize[], csv: string, mode: ImportMode = "upsert", available?: string[], changed: string[] = []) => {
  const parsed = parseTable(new TextEncoder().encode(csv), PRIZE_HEADERS);
  if (!parsed.ok) throw new Error(parsed.errors.join());
  return planImport(current, parsed.rows, prizeAdapter({ available: available ? new Set(available) : undefined, newId: () => "gen" }), mode, new Set(changed));
};

describe("prizeAdapter", () => {
  const full: Prize[] = [
    prize("a", { weight: 40, animation: "slot", image: "a.png", image2: "a2.png", winningImage1: "w1.png", winningImage2: "w2.png", bgm1: "b1.mp3", bgm2: "b2.mp3", order: 1 }),
    prize("b", { order: 2 }),
    prize("c", { weight: 7, animation: "roulette", order: 3 }),
  ];

  it("書き出した CSV をそのまま取り込むと、全行が変更なし(置き換えでも削除なし)", () => {
    const csv = exportTable(full, prizeAdapter());
    expect(csv).toContain("ルーレット");
    expect(csv).toContain("スロット");
    const p = plan(full, csv, "replace", ["a.png", "a2.png", "w1.png", "w2.png", "b1.mp3", "b2.mp3"]);
    expect(p.counts).toEqual({ add: 0, update: 0, unchanged: 3, delete: 0, error: 0 });
    expect(p.ok).toBe(true);
  });

  it("ID が空なら新しい景品(識別子を発行)。空のセルは未設定、重みは未指定のまま", () => {
    const p = plan([], "ID,名前\n,新しい景品\n");
    expect(p.counts.add).toBe(1);
    expect(p.upserts[0]).toMatchObject({ id: "gen", name: "新しい景品", animation: "roulette", weight: undefined });
  });

  it("既存の景品の空のセルは、いまのままを保つ。`-` で素材を外せる", () => {
    const current = [prize("a", { weight: 30, animation: "slot", image: "a.png", bgm1: "b.mp3" })];
    const keep = plan(current, "ID,名前\na,景品a\n");
    expect(keep.rows[0].status).toBe("unchanged");
    const removed = plan(current, "ID,名前,画像1,BGM1\na,景品a,-,\n");
    expect(removed.rows[0].status).toBe("update");
    expect(removed.upserts[0].image).toBeUndefined();
    expect(removed.upserts[0].bgm1).toBe("b.mp3");
  });

  it("アニメーションは日本語の名前でも英語の値でも書ける。ほかの値はエラー", () => {
    expect(plan([], "名前,アニメーション\nA,スロット\nB,roulette\n").upserts.map((p) => p.animation)).toEqual(["slot", "roulette"]);
    expect(plan([], "名前,アニメーション\nA,回転\n").rows[0]).toMatchObject({ status: "error", message: expect.stringContaining("ルーレット") });
  });

  it("名前が空・重みが範囲外・素材が見つからない行はエラーで、取り込めない", () => {
    const p = plan([], "ID,名前,当選確率の重み,画像1\n1,,5,\n2,B,0,\n3,C,5,none.png\n4,D,101,\n5,E,1.5,\n", "upsert", []);
    expect(p.rows.map((r) => r.status)).toEqual(["error", "error", "error", "error", "error"]);
    expect(p.ok).toBe(false);
    expect(p.upserts).toEqual([]);
  });

  it("素材のフォルダ付きの書き方(images/a.png)でもファイル名で照合する", () => {
    const p = plan([], "名前,画像1\nA,images/a.png\n", "upsert", ["a.png"]);
    expect(p.upserts[0].image).toBe("a.png");
  });

  it("差し替える素材を参照している行は、文字列が同じでも更新になる", () => {
    const current = [prize("a", { image: "a.png" })];
    expect(plan(current, "ID,名前,画像1\na,景品a,a.png\n", "upsert", ["a.png"], ["a.png"]).rows[0].status).toBe("update");
  });
});

describe("orderImportedPrizes", () => {
  it("置き換え: ファイルの行の順がそのまま並び順になる", () => {
    const current = [prize("a", { order: 1 }), prize("b", { order: 2 }), prize("c", { order: 3 })];
    const p = plan(current, "ID,名前\nc,景品c\n,新規\na,景品a\n", "replace");
    expect(orderImportedPrizes(p, "replace").map((x) => [x.id, x.order])).toEqual([["c", 1], ["gen", 2], ["a", 3]]);
  });

  it("追加・更新: 既存の並びを保ち、新しい景品は末尾に足す", () => {
    const current = [prize("a", { order: 1 }), prize("b", { order: 5 })];
    const p = plan(current, "ID,名前\n,新規1\nb,景品b改\n,新規2\n");
    const ordered = orderImportedPrizes(p, "upsert");
    expect(ordered.map((x) => [x.name, x.order])).toEqual([["景品a", 1], ["景品b改", 5], ["新規1", 6], ["新規2", 7]]);
  });

  it("置き換えでファイルに無い景品は含まれない(削除される)", () => {
    const p = plan([prize("a"), prize("b", { order: 2 })], "ID,名前\nb,景品b\n", "replace");
    expect(p.counts.delete).toBe(1);
    expect(orderImportedPrizes(p, "replace").map((x) => x.id)).toEqual(["b"]);
  });
});
