import { describe, expect, it } from "vitest";
import { exportTable, parseTable, planImport } from "@octopus/table-io";
import type { Member } from "../../../server/accounts-api-contract";
import { photoFileKey, photoFileName, ROSTER_HEADERS, rosterAdapter, toRosterMembers } from "./roster-table";

const bytes = (text: string) => new TextEncoder().encode(text);
const rowsOf = (text: string) => {
  const parsed = parseTable(bytes(text), ROSTER_HEADERS);
  if (!parsed.ok) throw new Error(parsed.errors.join());
  return parsed.rows;
};
const H1 = "0123456789abcdef";

describe("名簿の見出し", () => {
  it("日本語・英語どちらでも、列の順番は問わない。写真の列は任意", () => {
    expect(rowsOf("名前,ID\n花子,h1")).toEqual([{ line: 2, cells: { id: "h1", name: "花子", photo: "" } }]);
    expect(rowsOf("﻿id,photo,name\r\nh1,h1.png,Hana")[0].cells).toEqual({ id: "h1", name: "Hana", photo: "h1.png" });
  });

  it("必須の列が無い・データが無い・引用符が壊れているときは理由つきで失敗", () => {
    expect(parseTable(bytes("ID,写真\nh1,a.png"), ROSTER_HEADERS)).toMatchObject({ ok: false });
    expect(parseTable(bytes(""), ROSTER_HEADERS)).toMatchObject({ ok: false });
    expect(parseTable(bytes('ID,名前\n"h1,x'), ROSTER_HEADERS)).toMatchObject({ ok: false });
  });

  it("Shift_JIS の CSV も読める", () => {
    const sjis = new Uint8Array([0x49, 0x44, 0x2c, 0x96, 0xbc, 0x91, 0x4f, 0x0d, 0x0a, 0x31, 0x2c, 0x96, 0xbc, 0x91, 0x4f]);
    expect(parseTable(sjis, ROSTER_HEADERS)).toEqual({ ok: true, headers: ROSTER_HEADERS, rows: [{ line: 2, cells: { id: "1", name: "名前", photo: "" } }] });
  });
});

describe("rosterAdapter の計画", () => {
  const members: Member[] = [
    { id: "a", name: "アリス", photo: H1 },
    { id: "b", name: "ボブ" },
    { id: "root", name: "管理者", isAdmin: true },
    { id: "me", name: "自分" },
  ];
  const plan = (csv: string, mode: "upsert" | "replace", files: string[] = [], matched: [string, string][] = [], changed: string[] = []) =>
    planImport(toRosterMembers(members, new Map(matched)), rowsOf(csv), rosterAdapter({ files: new Set(files), currentUserId: "me" }), mode, new Set(changed));

  it("追加 / 更新 / 変更なし / エラー", () => {
    const p = plan("ID,名前,写真\na,アリス,\nb,ボビー,\nc,カール,\nd,,\n", "upsert");
    expect(p.rows.map((r) => r.status)).toEqual(["unchanged", "update", "add", "error"]);
    expect(p.rows[3].message).toBe("名前が空です");
  });

  it("ID の空の行は、既定では新規(名簿が採番)。ID を必ず決める画面(idRequired)ではエラー", () => {
    const csv = "ID,名前,写真\n,カール,\nc,チャーリー,\n";
    const lax = planImport(toRosterMembers(members), rowsOf(csv), rosterAdapter(), "upsert");
    expect(lax.rows.map((r) => r.status)).toEqual(["add", "add"]);
    const strict = planImport(toRosterMembers(members), rowsOf(csv), rosterAdapter({ idRequired: true }), "upsert");
    expect(strict.rows.map((r) => [r.status, r.message])).toEqual([["error", "ID が空です"], ["add", undefined]]);
    expect(strict.ok).toBe(false);
  });

  it("名前・ID が長すぎる / 画像が見つからない はエラー、ID の重複は後の行がエラー", () => {
    const long = "あ".repeat(101);
    const p = plan(`ID,名前,写真\nx,${long},\n${"i".repeat(65)},N,\ny,Y,none.png\nz,Z,\nz,Z2,\n`, "upsert");
    expect(p.rows.map((r) => r.message)).toEqual([
      expect.stringContaining("名前が長すぎ"),
      expect.stringContaining("ID が長すぎ"),
      "画像「none.png」が見つかりません",
      undefined,
      "ID が 5 行目と重複しています",
    ]);
  });

  it("書き出した写真をそのまま戻した行は変更なし、別の画像なら更新", () => {
    const same = plan("ID,名前,写真\na,アリス,A.PNG\n", "upsert", ["a.png"], [["a", "a.png"]]);
    expect(same.rows[0].status).toBe("unchanged");
    const other = plan("ID,名前,写真\na,アリス,A.PNG\n", "upsert", ["a.png"], [], ["a.png"]);
    expect(other.rows[0].status).toBe("update");
  });

  it("置き換えでも管理者とログイン中のメンバーは削除しない", () => {
    const p = plan("ID,名前\na,アリス\n", "replace");
    expect(p.deletes.map((m) => m.id)).toEqual(["b"]);
  });

  it("書き出して取り込むと全行が変更なし(写真つき・なしの両方)", () => {
    const names = new Map([["a", photoFileName("a", "image/webp")]]);
    for (const photoFiles of [new Map<string, string>(), names]) {
      const csv = exportTable(toRosterMembers(members, photoFiles), rosterAdapter());
      const matched = new Map([...photoFiles].map(([id, name]) => [id, photoFileKey(name)] as const));
      const p = planImport(toRosterMembers(members, matched), rowsOf(csv), rosterAdapter({ files: new Set(matched.values()) }), "replace");
      expect(p.counts).toEqual({ add: 0, update: 0, unchanged: members.length, delete: 0, error: 0 });
    }
  });
});

describe("写真のファイル名", () => {
  it("照合キーはフォルダ・大文字小文字・全角半角を無視する", () => {
    expect(photoFileKey("dir\\sub/ＡＢ.PNG")).toBe("ab.png");
  });

  it("書き出す名前は <id>.<拡張子>、ファイル名に使えない文字は _", () => {
    expect(photoFileName("a/b:c", "image/jpeg")).toBe("a_b_c.jpg");
    expect(photoFileName("x", "image/unknown")).toBe("x.img");
  });
});
