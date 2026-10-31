import { describe, expect, it } from "vitest";
import type { Member } from "../../../server/accounts-api-contract";
import { exportRosterCsv, parseRosterCsv, photoFileKey, photoFileName, planRosterImport, rosterUpserts } from "./roster-csv";
import type { RosterCsvRow } from "./roster-csv";

const bytes = (text: string) => new TextEncoder().encode(text);
const rowsOf = (text: string): RosterCsvRow[] => {
  const parsed = parseRosterCsv(bytes(text));
  if (!parsed.ok) throw new Error(parsed.errors.join());
  return parsed.rows;
};
const H1 = "0123456789abcdef";
const H2 = "fedcba9876543210";

describe("parseRosterCsv", () => {
  it("ヘッダーは日本語・英語どちらでも、列の順番は問わない。写真の列は任意", () => {
    expect(rowsOf("名前,ID\n花子,h1")).toEqual([{ line: 2, id: "h1", name: "花子", photo: "" }]);
    expect(rowsOf("﻿id,photo,name\r\nh1,h1.png,Hana")).toEqual([{ line: 2, id: "h1", name: "Hana", photo: "h1.png" }]);
  });

  it("必須の列が無い・データが無い・引用符が壊れているときは理由つきで失敗", () => {
    expect(parseRosterCsv(bytes("ID,写真\nh1,a.png"))).toMatchObject({ ok: false });
    expect(parseRosterCsv(bytes(""))).toMatchObject({ ok: false });
    expect(parseRosterCsv(bytes('ID,名前\n"h1,x'))).toMatchObject({ ok: false });
  });

  it("Shift_JIS の CSV も読める", () => {
    // 「ID,名前\r\n1,名前」(名前=0x96 0xbc 0x91 0x4f)
    const sjis = new Uint8Array([0x49, 0x44, 0x2c, 0x96, 0xbc, 0x91, 0x4f, 0x0d, 0x0a, 0x31, 0x2c, 0x96, 0xbc, 0x91, 0x4f]);
    expect(parseRosterCsv(sjis)).toEqual({ ok: true, rows: [{ line: 2, id: "1", name: "名前", photo: "" }] });
  });

  it("セルの前後の空白は取り除く", () => {
    expect(rowsOf("ID,名前\n h1 , 花子 ")[0]).toMatchObject({ id: "h1", name: "花子" });
  });
});

describe("planRosterImport", () => {
  const current: Member[] = [
    { id: "a", name: "アリス", photo: H1 },
    { id: "b", name: "ボブ" },
  ];
  const plan = (csv: string, files: Record<string, string> = {}) =>
    planRosterImport(current, rowsOf(csv), new Map(Object.entries(files)));

  it("追加・更新・変更なし・エラーを行ごとに判断する", () => {
    const result = plan("ID,名前\na,アリス\nb,ボビー\nc,キャロル\nd,\n");
    expect(result.rows.map((r) => r.status)).toEqual(["unchanged", "update", "add", "error"]);
    expect(result.counts).toEqual({ add: 1, update: 1, unchanged: 1, error: 1 });
  });

  it("IDが空の行は追加(自動採番)。同じIDが2回出たら後の行がエラー", () => {
    const result = plan("ID,名前\n,新人\nz,Z1\nz,Z2");
    expect(result.rows.map((r) => r.status)).toEqual(["add", "add", "error"]);
    expect(result.rows[2].message).toContain("3 行目");
  });

  it("画像: 見つからなければエラー、新しい画像は縮小の対象、いまの写真と同一なら変更なし", () => {
    const result = plan("ID,名前,写真\na,アリス,A.PNG\nb,ボブ,sub/b.png\nc,キャロル,missing.png", {
      "a.png": H1, // 書き出した写真をそのまま戻した
      "b.png": H2,
    });
    expect(result.rows.map((r) => r.status)).toEqual(["unchanged", "update", "error"]);
    expect(result.rows[2].message).toContain("missing.png");
    expect(result.photoKeys).toEqual(["b.png"]);
  });

  it("写真の列が空なら写真は触らない", () => {
    const result = plan("ID,名前,写真\na,アリス,");
    expect(result.rows[0]).toMatchObject({ status: "unchanged", photoKey: undefined });
  });

  it("名前の長さなどの不正はエラー", () => {
    expect(plan(`ID,名前\nx,${"あ".repeat(101)}`).rows[0].status).toBe("error");
    expect(plan(`ID,名前\n${"i".repeat(65)},x`).rows[0].status).toBe("error");
  });
});

describe("rosterUpserts", () => {
  it("追加・更新だけを、写真のハッシュつきで返す。画像が準備できなかった行は除く", () => {
    const result = planRosterImport(
      [{ id: "b", name: "ボブ" }],
      rowsOf("ID,名前,写真\nb,ボブ,b.png\n,新人,n.png\nz,Z,z.png\nq,Q,"),
      new Map([["b.png", H1], ["n.png", H2], ["z.png", H1]])
    );
    const { upserts, skipped } = rosterUpserts(result, new Map([["b.png", H1], ["n.png", H2]]));
    expect(upserts).toEqual([
      { id: "b", name: "ボブ", photo: H1 },
      { id: undefined, name: "新人", photo: H2 },
      { id: "q", name: "Q", photo: undefined },
    ]);
    expect(skipped.map((r) => r.id)).toEqual(["z"]);
  });
});

describe("書き出し → 取込の往復", () => {
  const members: Member[] = [
    { id: "a", name: "アリス, \"A\"", photo: H1 },
    { id: "b", name: "ボブ" },
    { id: "c/d", name: "改行\nあり", photo: H2 },
  ];

  it("書き出した CSV と写真を取り込むと、全行「変更なし」になる", () => {
    const names = new Map([["a", photoFileName("a", "image/webp")], ["c/d", photoFileName("c/d", "image/jpeg")]]);
    const csv = exportRosterCsv(members, names);
    expect(csv.startsWith("﻿")).toBe(true);
    const parsed = parseRosterCsv(bytes(csv));
    if (!parsed.ok) throw new Error("parse");
    // 写真のファイルは、書き出した内容(=名簿の写真と同じハッシュ)がそのまま戻ってくる
    const files = new Map([[photoFileKey("a.webp"), H1], [photoFileKey("c_d.jpg"), H2]]);
    const result = planRosterImport(members, parsed.rows, files);
    expect(result.rows.map((r) => r.status)).toEqual(["unchanged", "unchanged", "unchanged"]);
    expect(result.photoKeys).toEqual([]);
  });

  it("CSV だけ(写真の列は空)でも往復で変更なし", () => {
    const parsed = parseRosterCsv(bytes(exportRosterCsv(members)));
    if (!parsed.ok) throw new Error("parse");
    expect(planRosterImport(members, parsed.rows, new Map()).counts).toEqual({ add: 0, update: 0, unchanged: 3, error: 0 });
  });
});
