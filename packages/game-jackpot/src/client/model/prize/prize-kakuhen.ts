import type { Prize } from "../../../server/jackpot-api-contract";

type KakuhenFields = Pick<Prize, "kakuhen" | "image2" | "winningImage2" | "bgm2">;

/**
 * 確変対応あり(ON)か。`kakuhen` が決まっていればそれに従う。
 * 未設定(この項目ができる前に保存された景品)は、2枚目の素材(画像2・当選画像2・BGM2)のどれかがあればONとみなす。
 */
export function isKakuhenPrize(p: KakuhenFields): boolean {
  if (typeof p.kakuhen === "boolean") return p.kakuhen;
  return !!(p.image2 || p.winningImage2 || p.bgm2);
}

/**
 * 古い景品に `kakuhen` を補う(読み込み時の非破壊の正規化)。素材は消さない。何度かけても同じ結果。
 * すでに `kakuhen` がある景品は、同じオブジェクトをそのまま返す。
 */
export function normalizePrizeKakuhen<T extends KakuhenFields>(p: T): T {
  return typeof p.kakuhen === "boolean" ? p : { ...p, kakuhen: isKakuhenPrize(p) };
}

/** 確変対応ONの景品の数(確変ターンの数になる)。 */
export function countKakuhenPrizes(prizes: readonly KakuhenFields[]): number {
  return prizes.filter(isKakuhenPrize).length;
}
