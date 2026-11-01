import { describe, expect, it } from "vitest";
import { exportTable, normalizeHeader, parseTable, planImport } from "@octopus/table-io";
import type { ImportMode } from "@octopus/table-io";
import type { QuizRecordEntry } from "../../../server/quiz-api-contract";
import { maxOptionNo, optionColumnCount, quizAdapter, quizHeaders, quizHeadersFromNames } from "./quiz-table";

const bytes = (text: string) => new TextEncoder().encode(text);

const quiz = (over: Partial<QuizRecordEntry> = {}): QuizRecordEntry => ({
  id: "q1",
  title: "首都は?",
  question: "日本の首都は",
  options: [
    { no: 1, text: "東京", color: "red", image: "tokyo.png" },
    { no: 2, text: "大阪", color: "#3b82f6", image: null },
    { no: 4, text: "京都", color: "green", image: null },
  ],
  correctNo: 1,
  timeLimit: 20,
  bgm: "bgm.wav",
  settings: { correctBgm: "ok.wav", prizeImage: "gift.png", prizeName: "お菓子", prizeBgm: null },
  ...over,
});

const FILES = new Set(["tokyo.png", "bgm.wav", "ok.wav", "gift.png", "new.png"]);

function run(csv: string, current: QuizRecordEntry[], mode: ImportMode = "upsert", changed: string[] = [], files: ReadonlySet<string> = FILES) {
  const parsed = parseTable(bytes(csv), quizHeadersFromNames);
  if (!parsed.ok) throw new Error(parsed.errors.join());
  const optionCount = Math.max((parsed.headers.length - quizHeaders(0).length) / 3, maxOptionNo(current));
  return planImport(current, parsed.rows, quizAdapter({ optionCount, available: files }), mode, new Set(changed));
}

const exported = (items: QuizRecordEntry[]) => exportTable(items, quizAdapter({ optionCount: maxOptionNo(items) }));

describe("クイズの列", () => {
  it("書き出しの列は、選択肢の番号の最大まで 選択肢k / 選択肢k画像 / 選択肢k色", () => {
    const head = exported([quiz()]).split("\r\n")[0].replace("﻿", "").split(",");
    expect(head.slice(0, 10)).toEqual(["ID", "タイトル", "問題", "制限時間(秒)", "正解(選択肢の番号)", "BGM", "正解BGM", "景品名", "景品画像", "景品BGM"]);
    expect(head.slice(10)).toEqual(["選択肢1", "選択肢1画像", "選択肢1色", "選択肢2", "選択肢2画像", "選択肢2色", "選択肢3", "選択肢3画像", "選択肢3色", "選択肢4", "選択肢4画像", "選択肢4色"]);
  });

  it("取込の列の数は CSV の見出しから決める(日本語と英語の別名、全角数字、画像・色だけの列も)", () => {
    const n = (...names: string[]) => optionColumnCount(names.map(normalizeHeader));
    expect(n("ID", "タイトル")).toBe(0);
    expect(n("選択肢1", "選択肢３", "選択肢2画像")).toBe(3);
    expect(n("Option1", "OPTION5Color", "option2image")).toBe(5);
    expect(n("選択肢画像", "選択肢0", "選択肢x")).toBe(0);
    expect(n("選択肢100", "選択肢101")).toBe(100);
  });

  it("英語の見出しでも読める", () => {
    const plan = run("title,question,option1,option2,correct\nT,Q,a,b,2\n", []);
    expect(plan.ok).toBe(true);
    expect(plan.upserts[0]).toMatchObject({ title: "T", correctNo: 2, options: [{ no: 1, text: "a" }, { no: 2, text: "b" }] });
  });
});

describe("往復", () => {
  it("書き出してそのまま取り込むと、全行が変更なし(選択肢k列・番号の飛び・景品・素材を含む)", () => {
    const items = [quiz(), quiz({ id: "q2", options: [], bgm: null, settings: undefined, correctNo: 1 }), quiz({ id: "q3", title: "改行,\"引用\"\nあり" })];
    const plan = run(exported(items), items, "replace");
    expect(plan.ok).toBe(true);
    expect(plan.counts).toMatchObject({ unchanged: 3, add: 0, update: 0, delete: 0, error: 0 });
  });

  it("CSV だけを取り込み直しても素材は変わらない(素材のセルが空 = いまのまま)", () => {
    const items = [quiz()];
    const csv = exported(items).replace(/tokyo\.png|bgm\.wav|ok\.wav|gift\.png/g, "");
    const plan = run(csv, items, "upsert", [], new Set());
    expect(plan.counts.unchanged).toBe(1);
  });

  it("素材のセルの - は素材を外す", () => {
    const items = [quiz()];
    const plan = run(exported(items).replace("bgm.wav", "-"), items);
    expect(plan.counts.update).toBe(1);
    expect(plan.next[0].bgm).toBeNull();
  });
});

describe("検証", () => {
  const head = "ID,タイトル,問題,正解,選択肢1,選択肢2,選択肢2色,選択肢2画像\n";

  it("正解が存在しない選択肢を指していれば、その行がエラー", () => {
    const plan = run(`${head}a,T,Q,3,x,y,,\n`, []);
    expect(plan.ok).toBe(false);
    expect(plan.rows[0]).toMatchObject({ status: "error", message: expect.stringContaining("正解") });
  });

  it("正解が空なら先頭の選択肢。選択肢が無ければ 1", () => {
    expect(run(`${head}a,T,Q,,x,y,,\n`, []).next[0].correctNo).toBe(1);
    expect(run(`${head}a,T,Q,,,y,,\n`, []).next[0].correctNo).toBe(2);
  });

  it("色は #rrggbb(または既定の色名)。空は既定", () => {
    expect(run(`${head}a,T,Q,1,x,y,#FF00aa,\n`, []).next[0].options[1].color).toBe("#ff00aa");
    expect(run(`${head}a,T,Q,1,x,y,,\n`, []).next[0].options[1].color).toBe("red");
    const bad = run(`${head}a,T,Q,1,x,y,pink,\n`, []);
    expect(bad.rows[0]).toMatchObject({ status: "error", message: expect.stringContaining("色") });
    expect(run(`${head}a,T,Q,1,x,y,#12345,\n`, []).ok).toBe(false);
  });

  it("選択肢は文字か画像があるときだけ作る", () => {
    const plan = run("ID,タイトル,問題,選択肢1,選択肢2,選択肢2画像,選択肢3色\na,T,Q,,,new.png,#ffffff\n", []);
    expect(plan.next[0].options).toEqual([{ no: 2, text: "", color: "red", image: "new.png" }]);
  });

  it("タイトル・問題が空、制限時間が不正、素材が無い行はエラー", () => {
    expect(run("ID,タイトル,問題\na,,Q\n", []).ok).toBe(false);
    expect(run("ID,タイトル,問題\na,T,\n", []).ok).toBe(false);
    expect(run("ID,タイトル,問題,制限時間\na,T,Q,0\n", []).ok).toBe(false);
    expect(run("ID,タイトル,問題,制限時間\na,T,Q,abc\n", []).ok).toBe(false);
    const missing = run("ID,タイトル,問題,BGM\na,T,Q,none.wav\n", []);
    expect(missing.rows[0]).toMatchObject({ status: "error", message: expect.stringContaining("none.wav") });
  });

  it("ID が空の行は新しい ID が付き、同じ ID の重複はエラー", () => {
    const plan = run("ID,タイトル,問題\n,T,Q\n,T2,Q2\n", []);
    expect(plan.upserts.map((q) => q.id).every((id) => id.length > 8)).toBe(true);
    expect(new Set(plan.upserts.map((q) => q.id)).size).toBe(2);
    expect(run("ID,タイトル,問題\na,T,Q\na,T,Q\n", []).ok).toBe(false);
  });

  it("エラーが1行でもあれば、何も反映しない", () => {
    const plan = run("ID,タイトル,問題\na,T,Q\nb,,Q\n", [quiz()], "replace");
    expect(plan.ok).toBe(false);
    expect(plan.upserts).toEqual([]);
    expect(plan.deletes).toEqual([]);
  });
});

describe("更新と置き換え", () => {
  it("差し替える素材を使っている行は、文字が同じでも更新になる", () => {
    const items = [quiz(), quiz({ id: "q2", bgm: "ok.wav", options: [] })];
    const plan = run(exported(items), items, "upsert", ["bgm.wav"]);
    expect(plan.rows.map((r) => r.status)).toEqual(["update", "unchanged"]);
  });

  it("置き換えは、ファイルに無いクイズを削除する。upsert では残る", () => {
    const items = [quiz(), quiz({ id: "q2" })];
    const csv = exported([items[0]]);
    expect(run(csv, items, "replace").rows.map((r) => r.status)).toEqual(["unchanged", "delete"]);
    expect(run(csv, items, "replace").next.map((q) => q.id)).toEqual(["q1"]);
    expect(run(csv, items, "upsert").next.map((q) => q.id)).toEqual(["q1", "q2"]);
  });

  it("既存より CSV の選択肢の列が少なくても、既存の番号まで列を取る(外れた選択肢は更新として見える)", () => {
    const items = [quiz()];
    const plan = run("ID,タイトル,問題,選択肢1\nq1,首都は?,日本の首都は,東京\n", items);
    expect(plan.rows[0].status).toBe("update");
    expect(plan.next[0].options.map((o) => o.no)).toEqual([1]);
  });
});
