/**
 * 景品の表(CSV)への対応。汎用の判断(差分・往復・エラー)は `@octopus/table-io` に任せ、ここは列と検証だけを持つ。
 *
 * - 取り込む対象はレコードの景品そのもの({@link Prize})。画像・音声はファイル名(素材の名前)で持つ。
 * - 列: `ID, 名前*, 景品ランク, アニメーション(ルーレット|スロット), 確変対応(あり|なし), 抽選画像, 当選画像, 当選BGM, 確変_抽選画像, 確変_当選画像, 確変_当選BGM`。
 *   内部の項目との対応: 抽選画像=image、当選画像=winningImage1、当選BGM=bgm1、確変_抽選画像=image2、確変_当選画像=winningImage2、確変_当選BGM=bgm2。
 * - 景品ランクは1〜5(標準3、5=豪華でレア)。古い書き出しの「当選確率の重み」列は意味が違うので読まずに無視する(ランクは既定の3になる)。
 * - 確変対応は あり/なし(それ以外の書き方はエラー)。ありの景品だけが確変ターンのフェイク演出に使われ、確変_ の3列が有効になる。
 *   列が無い・空のセルは、いまのまま(新規は未設定。2枚目の素材があればありとして扱う)。
 * - 空のセル = いまのまま(新規なら未設定)。素材のセルは `-` で外す。
 * - 並び順(`order`)は列に無い。置き換えではファイルの行の順がそのまま並び順、追加・更新では既存の並びを保って新しい景品を末尾に足す
 *   ({@link orderImportedPrizes})。
 */
import { resolveMediaCell } from "@octopus/table-io";
import type { Header, ImportMode, ImportPlan, Row, TableAdapter } from "@octopus/table-io";
import type { Prize } from "../../../server/jackpot-api-contract";
import { MAX_PRIZE_RANK, MIN_PRIZE_RANK } from "../../model/prize/prize-rank";
import { isKakuhenPrize } from "../../model/prize/prize-kakuhen";

export const PRIZE_CSV_NAME = "prizes.csv";

/** アニメーションの値と、CSV に書く名前。 */
const ANIMATION_LABELS: Readonly<Record<string, string>> = { roulette: "ルーレット", slot: "スロット" };
const DEFAULT_ANIMATION = "roulette";

/** 確変対応のセルの書き方(あり/なしだけ)。 */
const KAKUHEN_ON = "あり";
const KAKUHEN_OFF = "なし";

/** 素材の列(CSV の列名と内部の項目の対応)。確変_ で始まる列は確変対応ありの景品だけが使う2つ目の素材。 */
const MEDIA_COLUMNS = [
  ["image", "抽選画像"],
  ["winningImage1", "当選画像"],
  ["bgm1", "当選BGM"],
  ["image2", "確変_抽選画像"],
  ["winningImage2", "確変_当選画像"],
  ["bgm2", "確変_当選BGM"],
] as const;

export const PRIZE_HEADERS: readonly Header[] = [
  { key: "id", label: "ID" },
  { key: "name", label: "名前", required: true },
  { key: "rank", label: "景品ランク" },
  { key: "animation", label: "アニメーション" },
  { key: "kakuhen", label: "確変対応" },
  ...MEDIA_COLUMNS.map(([key, label]): Header => ({ key, label, media: true })),
];

/** 使えなくなった古い見出し → 今の見出し。ファイルに残っていれば、黙って無視せずエラーにする。 */
export const PRIZE_RETIRED_HEADERS: Readonly<Record<string, string>> = {
  画像1: "抽選画像",
  画像: "抽選画像",
  当選画像1: "当選画像",
  BGM1: "当選BGM",
  画像2: "確変_抽選画像",
  当選画像2: "確変_当選画像",
  BGM2: "確変_当選BGM",
};

export interface PrizeAdapterOptions {
  /** 使える素材の名前(いまの素材 + 選ばれたファイル)。CSV が指す素材がこの中に無ければエラー。省略すると検査しない(書き出し用)。 */
  available?: ReadonlySet<string>;
  /** `ID` が空の新規行に付ける識別子。 */
  newId?: () => string;
}

/** 景品の `TableAdapter`。取込では使える素材の名前を渡し、書き出しでは何も渡さない。 */
export function prizeAdapter({ available, newId = () => crypto.randomUUID() }: PrizeAdapterOptions = {}): TableAdapter<Prize> {
  return {
    csvName: PRIZE_CSV_NAME,
    headers: PRIZE_HEADERS,
    labelKey: "name",
    key: (p) => p.id,
    newKey: newId,
    toRow: (p): Row => ({
      id: p.id,
      name: p.name,
      rank: p.rank === undefined ? "" : String(p.rank),
      animation: ANIMATION_LABELS[p.animation ?? DEFAULT_ANIMATION] ?? p.animation ?? "",
      kakuhen: isKakuhenPrize(p) ? KAKUHEN_ON : KAKUHEN_OFF,
      ...Object.fromEntries(MEDIA_COLUMNS.map(([key]) => [key, p[key] ?? ""])),
    }),
    fromRow(row, existing) {
      if (!row.name) return "名前が空です";

      let rank = existing?.rank;
      if (row.rank) {
        const n = Number(row.rank);
        if (!Number.isInteger(n) || n < MIN_PRIZE_RANK || n > MAX_PRIZE_RANK) return `景品ランクは${MIN_PRIZE_RANK}〜${MAX_PRIZE_RANK}の整数で入力してください`;
        rank = n;
      }

      let animation = existing?.animation ?? DEFAULT_ANIMATION;
      if (row.animation) {
        const found = Object.entries(ANIMATION_LABELS).find(([key, label]) => row.animation === label || row.animation.toLowerCase() === key);
        if (!found) return "アニメーションは「ルーレット」か「スロット」で入力してください";
        animation = found[0];
      }

      let kakuhen = existing?.kakuhen;
      if (row.kakuhen) {
        const v = row.kakuhen.trim();
        if (v === KAKUHEN_ON) kakuhen = true;
        else if (v === KAKUHEN_OFF) kakuhen = false;
        else return "確変対応は「あり」か「なし」で入力してください";
      }

      const prize: Prize = { id: row.id, name: row.name, rank, animation, order: existing?.order ?? 0 };
      if (kakuhen !== undefined) prize.kakuhen = kakuhen;
      for (const [key, label] of MEDIA_COLUMNS) {
        const r = resolveMediaCell(row[key], existing?.[key], available);
        if ("missing" in r) return `${label}「${r.missing}」が見つかりません`;
        if (r.name) prize[key] = r.name;
      }
      return prize;
    },
  };
}

/**
 * 取込後の景品に並び順(`order`)を付ける。
 * 置き換え: ファイルの行の順がそのまま 1, 2, 3…。追加・更新: 既存の並びを保ち、新しい景品(order が 0)を末尾に足す。
 */
export function orderImportedPrizes(plan: Pick<ImportPlan<Prize>, "rows" | "next">, mode: ImportMode): Prize[] {
  if (mode === "replace") {
    const position = new Map(plan.rows.filter((r) => r.line !== null).map((r, i) => [r.key, i + 1] as const));
    return plan.next.map((p) => ({ ...p, order: position.get(p.id) ?? p.order })).sort((a, b) => a.order - b.order);
  }
  let last = Math.max(0, ...plan.next.map((p) => p.order));
  return plan.next.map((p) => (p.order > 0 ? p : { ...p, order: ++last }));
}
