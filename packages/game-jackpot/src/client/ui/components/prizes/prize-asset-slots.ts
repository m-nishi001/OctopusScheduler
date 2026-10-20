/**
 * 景品フォームの素材欄(画像4つ・BGM2つ)の定義。
 * 欄ごとの違い(どの項目に入るか・表示名・種類・画面上の位置)はここだけに持ち、
 * フォームは同じ処理を欄の数だけ繰り返す。
 */
import type { Prize } from '@model/prize/prize';

export type PrizeAssetField =
  | 'imageAssetId'
  | 'image2AssetId'
  | 'winningImage1AssetId'
  | 'winningImage2AssetId'
  | 'bgm1AssetId'
  | 'bgm2AssetId';

export interface PrizeAssetSlot {
  /** 景品のどの項目に素材の id を入れるか。 */
  field: PrizeAssetField;
  label: string;
  kind: 'image' | 'bgm';
  /** 選んだ画像をまだ保存していない間の、プレビュー用 URL の置き場所。BGM は無い。 */
  previewKey?: string;
  /** フォーム内の位置を決める CSS のクラス。 */
  area: string;
}

export const PRIZE_ASSET_SLOTS: readonly PrizeAssetSlot[] = [
  { field: 'imageAssetId', label: '画像1', kind: 'image', previewKey: 'temp-image1', area: 'image1-preview' },
  { field: 'image2AssetId', label: '画像2', kind: 'image', previewKey: 'temp-image2', area: 'image2-section' },
  { field: 'winningImage1AssetId', label: '当選画像1', kind: 'image', previewKey: 'temp-winning-image1', area: 'winning-image1-section' },
  { field: 'winningImage2AssetId', label: '当選画像2', kind: 'image', previewKey: 'temp-winning-image2', area: 'winning-image2-section' },
  { field: 'bgm1AssetId', label: 'BGM1', kind: 'bgm', area: 'bgm1' },
  { field: 'bgm2AssetId', label: 'BGM2', kind: 'bgm', area: 'bgm2' },
];

export const IMAGE_SLOTS = PRIZE_ASSET_SLOTS.filter((s) => s.kind === 'image');
export const BGM_SLOTS = PRIZE_ASSET_SLOTS.filter((s) => s.kind === 'bgm');

/** 素材の選び方。既存から選ぶ(select)か、新しくアップロードするか(upload)。 */
export type SlotMode = 'select' | 'upload';

/** 新規の景品の初期の選び方(画像は新規アップロード、BGM は既存から)。 */
export const initialSlotMode = (slot: PrizeAssetSlot): SlotMode => (slot.kind === 'image' ? 'upload' : 'select');

/** 編集で開いた景品の選び方。素材が入っていれば既存から選ぶ形で、無ければ新規アップロード。 */
export const slotModeFor = (prize: Partial<Prize>, slot: PrizeAssetSlot): SlotMode => (prize[slot.field] ? 'select' : 'upload');
