/**
 * 景品の表(CSV)への対応。汎用の判断(差分・往復・エラー)は `@octopus/table-io` に任せ、ここは列と検証だけを持つ。
 *
 * - 取り込む対象はレコードの景品そのもの({@link Prize})。画像・音声はファイル名(素材の名前)で持つ。
 * - 列: `ID, 名前*, 景品ランク, アニメーション(ルーレット|スロット), 確変対応(あり|なし), 画像1, 画像2, 当選画像1, 当選画像2, BGM1, BGM2`。
 * - 景品ランクは1〜5(標準3、5=豪華でレア)。古い書き出しの「当選確率の重み」列は意味が違うので読まずに無視する(ランクは既定の3になる)。
 * - 確変対応は あり/なし(ON/OFF・true/false・1/0 も可)。ありの景品だけが確変ターンのフェイク演出に使われ、画像2・当選画像2・BGM2が有効になる。
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

/** 確変対応のセルの書き方。 */
const KAKUHEN_ON = ["あり", "on", "true", "1", "はい", "○"];
const KAKUHEN_OFF = ["なし", "off", "false", "0", "いいえ", "×"];

export const PRIZE_HEADERS: readonly Header[] = [
  { key: "id", label: "ID", aliases: ["景品ID", "prizeId"] },
  { key: "name", label: "名前", aliases: ["name", "景品名"], required: true },
  { key: "rank", label: "景品ランク", aliases: ["rank", "ランク"] },
  { key: "animation", label: "アニメーション", aliases: ["animation", "抽選アニメーション"] },
  { key: "kakuhen", label: "確変対応", aliases: ["kakuhen", "確変"] },
  { key: "image", label: "画像1", aliases: ["image", "image1", "画像"], media: true },
  { key: "image2", label: "画像2", aliases: ["image2"], media: true },
  { key: "winningImage1", label: "当選画像1", aliases: ["winningImage1"], media: true },
  { key: "winningImage2", label: "当選画像2", aliases: ["winningImage2"], media: true },
  { key: "bgm1", label: "BGM1", aliases: ["bgm1"], media: true },
  { key: "bgm2", label: "BGM2", aliases: ["bgm2"], media: true },
];

const MEDIA_COLUMNS = [
  ["image", "画像1"],
  ["image2", "画像2"],
  ["winningImage1", "当選画像1"],
  ["winningImage2", "当選画像2"],
  ["bgm1", "BGM1"],
  ["bgm2", "BGM2"],
] as const;

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
      kakuhen: isKakuhenPrize(p) ? "あり" : "なし",
      image: p.image ?? "",
      image2: p.image2 ?? "",
      winningImage1: p.winningImage1 ?? "",
      winningImage2: p.winningImage2 ?? "",
      bgm1: p.bgm1 ?? "",
      bgm2: p.bgm2 ?? "",
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
        const v = row.kakuhen.trim().toLowerCase();
        if (KAKUHEN_ON.includes(v)) kakuhen = true;
        else if (KAKUHEN_OFF.includes(v)) kakuhen = false;
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
