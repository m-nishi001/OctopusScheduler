import { describe, expect, it } from "vitest";
import { parseTable } from "./csv";
import type { Header, Row } from "./csv";
import { exportTable, planImport } from "./table";
import type { TableAdapter } from "./table";

interface Item {
  id: string;
  name: string;
  pic: string;
  locked?: boolean;
}

const headers: Header[] = [
  { key: "id", label: "ID" },
  { key: "name", label: "名前", required: true },
  { key: "pic", label: "画像", aliases: ["picture"], media: true },
];

let counter = 0;
const adapter: TableAdapter<Item> = {
  csvName: "items.csv",
  headers,
  labelKey: "name",
  key: (e) => e.id,
  toRow: (e): Row => ({ id: e.id, name: e.name, pic: e.pic }),
  fromRow: (row, existing) => (row.name ? { id: row.id, name: row.name, pic: row.pic, locked: existing?.locked } : "名前が空です"),
  newKey: () => `new-${++counter}`,
  protected: (e) => e.locked === true,
};

const current: Item[] = [
  { id: "a", name: "Alice", pic: "a.png" },
  { id: "b", name: "Bob", pic: "" },
  { id: "me", name: "Me", pic: "", locked: true },
];

const parse = (csv: string) => {
  const t = parseTable(new TextEncoder().encode(csv), headers);
  if (!t.ok) throw new Error(t.errors.join());
  return t.rows;
};
const statuses = (csv: string, mode: "upsert" | "replace" = "upsert", changed: string[] = []) =>
  planImport(current, parse(csv), adapter, mode, new Set(changed));

describe("planImport の5つの状態", () => {
  it("add / update / unchanged / error を判定する", () => {
    const plan = statuses("ID,名前,画像\na,Alice,a.png\nb,Bobby,\n,Carol,\nx,,\n");
    expect(plan.rows.map((r) => [r.key, r.status])).toEqual([
      ["a", "unchanged"],
      ["b", "update"],
      ["new-1", "add"],
      ["x", "error"],
    ]);
  });

  it("追加・更新・変更なし・削除(置き換え)が数えられ、保護された項目は削除されない", () => {
    const plan = statuses("ID,名前,画像\na,Alice,a.png\nc,Carol,\n", "replace");
    expect(plan.ok).toBe(true);
    expect(plan.counts).toEqual({ add: 1, update: 0, unchanged: 1, delete: 1, error: 0 });
    expect(plan.deletes.map((e) => e.id)).toEqual(["b"]);
    expect(plan.rows.find((r) => r.status === "delete")).toMatchObject({ key: "b", label: "Bob", line: null });
    expect(plan.next.map((e) => e.id)).toEqual(["a", "me", "c"]);
  });

  it("upsert ではファイルに無い項目に触れない", () => {
    const plan = statuses("ID,名前,画像\nb,Bobby,\n");
    expect(plan.counts.delete).toBe(0);
    expect(plan.next.map((e) => e.name)).toEqual(["Alice", "Bobby", "Me"]);
    expect(plan.upserts.map((e) => e.id)).toEqual(["b"]);
  });

  it("ID が空の行は新規になり、newKey が付く", () => {
    const plan = statuses("ID,名前,画像\n,Dave,\n");
    expect(plan.rows[0]).toMatchObject({ status: "add", key: expect.stringMatching(/^new-/) });
  });

  it("差し替える素材を参照している行は、文字列が同じでも update", () => {
    const plan = statuses("ID,名前,画像\na,Alice,a.png\n", "upsert", ["a.png"]);
    expect(plan.rows[0].status).toBe("update");
  });

  it("別名の見出し(picture)でも読める", () => {
    const plan = statuses("id,name,picture\na,Alice,a.png\n".replace("name", "名前"));
    expect(plan.rows[0].status).toBe("unchanged");
  });
});

describe("書き出して取り込むと全行が変更なし", () => {
  it("往復で全行 unchanged、反映するものは無い", () => {
    const csv = exportTable(current, adapter);
    expect(csv.startsWith("﻿")).toBe(true);
    const plan = planImport(current, parse(csv.slice(1)), adapter, "replace");
    expect(plan.ok).toBe(true);
    expect(plan.counts).toEqual({ add: 0, update: 0, unchanged: 3, delete: 0, error: 0 });
    expect(plan.upserts).toEqual([]);
    expect(plan.deletes).toEqual([]);
  });

  it("セル内の改行や前後の空白の差は無視する", () => {
    const withNote: Item[] = [{ id: "n", name: "x\ny", pic: "" }];
    const csv = '﻿ID,名前,画像\r\nn," x\r\ny ",\r\n';
    const t = parseTable(new TextEncoder().encode(csv), headers);
    expect(t.ok && planImport(withNote, t.rows, adapter, "upsert").counts.unchanged).toBe(1);
  });
});

describe("エラーがあれば取り込めない", () => {
  it("エラー行が1つでもあれば ok=false で、反映するものは何も無い(置き換えの削除も止まる)", () => {
    const plan = statuses("ID,名前,画像\nc,Carol,\nx,,\n", "replace");
    expect(plan.ok).toBe(false);
    expect(plan.upserts).toEqual([]);
    expect(plan.deletes).toEqual([]);
    expect(plan.next).toEqual(current);
    expect(plan.rows.find((r) => r.status === "error")).toMatchObject({ line: 3, message: "名前が空です" });
  });

  it("ID の重複は後の行がエラー", () => {
    const plan = statuses("ID,名前,画像\nc,Carol,\nc,Carl,\n");
    expect(plan.ok).toBe(false);
    expect(plan.rows[1]).toMatchObject({ status: "error", message: "ID が 2 行目と重複しています" });
  });

  it("エラーの行が指す既存の項目は、置き換えでも削除の候補にならない", () => {
    const plan = statuses("ID,名前,画像\nb,,\n", "replace");
    expect(plan.rows.filter((r) => r.status === "delete").map((r) => r.key)).toEqual(["a"]);
  });

  it("必須の列が無い CSV は読めない", () => {
    const t = parseTable(new TextEncoder().encode("ID,画像\na,x\n"), headers);
    expect(t).toEqual({ ok: false, errors: [expect.stringContaining("名前")] });
  });
});
