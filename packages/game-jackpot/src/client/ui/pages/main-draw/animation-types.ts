/** 景品抽選の演出（ルーレット・スロット）に流す1つの景品。止める場所を決めるのは id、見た目に使うのは name など。 */
export interface AnimationItem {
  id: string;
  name: string;
}

/**
 * 景品抽選の演出コンポーネント（ルーレット・スロット）が、親（抽選の進行）に公開する操作。
 * どちらも同じ形で、親は演出の種類を気にせず呼べる。
 */
export interface AnimationRef {
  startSpin?: (bgmUrl?: Blob | null) => void;
  /**
   * 指定した景品に止める。止まったら、その景品の id を返す。
   * 止める景品（`targetPrizeId`、省略時は選ばれた景品）が演出の中に無いときは、別の景品で止めず、例外にする
   * （画面の当選と、保存した抽選結果が食い違うため）。
   */
  stopSpin?: (
    durationSec?: number,
    targetPrizeId?: string | null,
    occurrence?: number,
    bgmUrl?: Blob | null
  ) => Promise<string | null>;
  /**
   * 演出に流す景品を差し替える。確変で、当選景品を2つに複製した一覧を流すときなどに使う。
   * 親が元の一覧に戻すときも、これを呼ぶ。
   */
  updatePrizes?: (items: ReadonlyArray<AnimationItem>) => Promise<void> | void;
  /** いま演出に流している景品（止められる景品）の一覧。 */
  getInternalItems?: () => ReadonlyArray<{ id: string }>;
}
