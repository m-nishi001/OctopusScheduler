import type { Prize } from "../../../model/prize/prize";

/** 画面用の景品。モデルの `Prize` と同じ項目で、アニメーションの既定値(ルーレット)を埋めたもの。 */
export type PrizeDto = Prize;

/** モデルの `Prize` を、画面用の `PrizeDto` にする。 */
export const fromPrize = (prize: Prize): PrizeDto => ({ ...prize, animation: prize.animation || "roulette" });
