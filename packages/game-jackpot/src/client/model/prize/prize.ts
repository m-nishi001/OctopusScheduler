export interface Prize {
  id: string;
  name: string;
  /** 当選確率の重み。目安は1〜100で、大きいほど当選しやすい。未設定時は既定値が使われる。 */
  weight?: number;
  imageAssetId?: string;
  image2AssetId?: string;
  bgm1AssetId?: string;
  bgm2AssetId?: string;
  animation?: string;
  order: number;
  winningImage1AssetId?: string;
  winningImage2AssetId?: string;
}

/** 景品のうち、画面で編集する項目(`id` と `order` は景品が持ち続けるので含めない)。 */
export type PrizeFields = Omit<Prize, "id" | "order">;

/** 既存の景品に、編集した項目を反映する。`id` と `order` は変えない。 */
export const applyPrizeEdit = (existing: Prize, fields: PrizeFields): Prize => ({
  ...fields,
  id: existing.id,
  order: existing.order,
});

/** 新しい景品を作る。`order` は既存の最大値 + 1(既存が無ければ 1)。`id` は呼び出し側が発行して渡す。 */
export const createPrize = (
  fields: PrizeFields,
  existing: ReadonlyArray<Pick<Prize, "order">>,
  id: string
): Prize => ({
  ...fields,
  id,
  order: existing.reduce((max, p) => Math.max(max, p.order), 0) + 1,
});
