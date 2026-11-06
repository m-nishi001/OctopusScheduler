/**
 * 表の取込・書き出しの判断をすべてここに集めた純粋関数(Vue にも通信にも依存しない)。
 *
 * 画面ごとに書くのは {@link TableAdapter} だけ。取込の計画 {@link planImport} は、次の約束を仕組みで守る。
 * - 差分の判定は、項目を `toRow` した行の文字列を正規化して比べるだけ(画面ごとの `equals` は無い)。
 *   そのため `exportTable` で書き出した CSV をそのまま取り込むと、全行が「変更なし」になる。
 * - エラーの行が1つでもあれば `ok: false`。そのとき反映するもの(`upserts` / `deletes`)は空で、取り込めない。
 * - 行の `id` 列({@link Row} のキー `id`)が項目の識別子。空なら新規。
 */
import { stringifyTable } from "./csv";
import type { Header, ParsedRow, Row } from "./csv";

export type RowStatus = "add" | "update" | "unchanged" | "delete" | "error";

/** 取込のモード: `upsert` は追加・更新だけ。`replace` はファイルに無い項目を削除する(オプトイン)。 */
export type ImportMode = "upsert" | "replace";

export interface TableAdapter<E> {
  /** 書き出す CSV のファイル名(ZIP の中の名前にもなる)。 */
  csvName: string;
  /** 列の定義。`id` のキーの列を持つこと。 */
  headers: readonly Header[];
  /** プレビューの「名前」欄に出す列の `key`。 */
  labelKey: string;
  /** 項目の識別子。 */
  key(e: E): string;
  /** 項目を CSV の1行にする。素材のセルはファイル名。 */
  toRow(e: E): Row;
  /** CSV の1行から項目を作る。`existing` は同じ `id` の既存の項目。文字列を返すとエラー文になる。 */
  fromRow(row: Row, existing: E | undefined): E | string;
  /** `id` が空の新規行に付ける識別子。無ければ空のまま(保存側で採番する)。 */
  newKey?(): string;
  /** 真の項目は、置き換えでも削除しない。 */
  protected?(e: E): boolean;
}

/** プレビューの1行。`line` は CSV の行番号(ファイルに無い=削除の行は null)。 */
export interface PlanRow {
  line: number | null;
  key: string;
  label: string;
  status: RowStatus;
  message?: string;
}

export interface ImportPlan<E> {
  rows: PlanRow[];
  counts: Record<RowStatus, number>;
  /** エラーの行が無いときだけ真。偽なら取り込めない。 */
  ok: boolean;
  /** 反映後の全項目(`ok` が偽なら現状のまま)。 */
  next: E[];
  /** 追加・更新する項目(ファイルの順。`ok` が偽なら空)。 */
  upserts: E[];
  /** 削除する項目(`replace` のときだけ。`ok` が偽なら空)。 */
  deletes: E[];
}

/** 比べるための正規化: 改行をそろえ、前後の空白を除く。 */
const normalizeCell = (value: string | undefined): string => (value ?? "").replace(/\r\n?/g, "\n").trim();

function rowText(headers: readonly Header[], row: Row): string {
  return JSON.stringify(headers.map((h) => normalizeCell(row[h.key])));
}

const emptyCounts = (): Record<RowStatus, number> => ({ add: 0, update: 0, unchanged: 0, delete: 0, error: 0 });

/**
 * 取り込みの計画を立てる。
 * @param mediaChanged 内容が変わる(または新しく入る)素材のファイル名。これを参照している行は、文字列が同じでも `update`。
 */
export function planImport<E>(
  current: readonly E[],
  rows: readonly ParsedRow[],
  adapter: TableAdapter<E>,
  mode: ImportMode,
  mediaChanged: ReadonlySet<string> = new Set()
): ImportPlan<E> {
  const { headers } = adapter;
  const mediaKeys = headers.filter((h) => h.media).map((h) => h.key);
  const byKey = new Map(current.map((e) => [adapter.key(e), e] as const));
  const firstLine = new Map<string, number>();
  const planned: PlanRow[] = [];
  const upserts: E[] = [];
  const replaced = new Map<string, E>();

  for (const row of rows) {
    const id = row.cells.id ?? "";
    const fail = (message: string): void => {
      planned.push({ line: row.line, key: id, label: row.cells[adapter.labelKey] ?? "", status: "error", message });
    };
    if (id) {
      const first = firstLine.get(id);
      firstLine.set(id, first ?? row.line);
      if (first !== undefined) {
        fail(`ID が ${first} 行目と重複しています`);
        continue;
      }
    }
    const existing = id ? byKey.get(id) : undefined;
    const cells: Row = id || !adapter.newKey ? row.cells : { ...row.cells, id: adapter.newKey() };
    const built = adapter.fromRow(cells, existing);
    if (typeof built === "string") {
      fail(built);
      continue;
    }
    const key = adapter.key(built);
    const builtRow = adapter.toRow(built);
    const label = builtRow[adapter.labelKey] ?? "";
    if (!existing) {
      planned.push({ line: row.line, key, label, status: "add" });
      upserts.push(built);
      continue;
    }
    const changed =
      rowText(headers, builtRow) !== rowText(headers, adapter.toRow(existing)) ||
      mediaKeys.some((k) => mediaChanged.has(normalizeCell(builtRow[k])));
    planned.push({ line: row.line, key, label, status: changed ? "update" : "unchanged" });
    if (changed) {
      upserts.push(built);
      replaced.set(key, built);
    }
  }

  const deletes =
    mode === "replace" ? current.filter((e) => !firstLine.has(adapter.key(e)) && !adapter.protected?.(e)) : [];
  for (const e of deletes) {
    planned.push({ line: null, key: adapter.key(e), label: adapter.toRow(e)[adapter.labelKey] ?? "", status: "delete" });
  }

  const counts = emptyCounts();
  for (const r of planned) counts[r.status]++;
  const ok = counts.error === 0;
  if (!ok) return { rows: planned, counts, ok, next: [...current], upserts: [], deletes: [] };

  const gone = new Set(deletes.map((e) => adapter.key(e)));
  const kept = current.filter((e) => !gone.has(adapter.key(e))).map((e) => replaced.get(adapter.key(e)) ?? e);
  const added = upserts.filter((e) => !byKey.has(adapter.key(e)));
  return { rows: planned, counts, ok, next: [...kept, ...added], upserts, deletes };
}

/** 項目を CSV にする(BOM つき UTF-8、CRLF)。書き出した CSV は {@link planImport} でそのまま取り込める。 */
export function exportTable<E>(items: readonly E[], adapter: TableAdapter<E>): string {
  return stringifyTable(adapter.headers, items.map((e) => adapter.toRow(e)));
}
