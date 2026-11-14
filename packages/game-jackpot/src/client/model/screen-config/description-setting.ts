/**
 * 説明画面の設定。1ページずつ表示し、Enter か管理端末の「次へ/前へ」で進める。
 * 説明は手で送る画面なので、効果・秒数・効果音は持たない。種類は 画像 / テキスト。
 */
export const DESCRIPTION_KINDS = ["画像", "テキスト"] as const;
export type DescriptionKind = (typeof DESCRIPTION_KINDS)[number];

export interface DescriptionPage {
  kind: DescriptionKind;
  /** kind が 画像 のときの、画像の素材の名前。 */
  image?: string;
  /** kind が テキスト のときの本文。 */
  text?: string;
  /** 再生のとき、素材から作る表示用の URL(保存しない)。 */
  imageUrl?: string;
}

export interface DescriptionSettings {
  bgm: string;
  pages: DescriptionPage[];
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

function parsePage(raw: unknown): DescriptionPage | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.kind === "画像") return { kind: "画像", image: str(r.image) };
  if (r.kind === "テキスト") return { kind: "テキスト", text: str(r.text) };
  return null;
}

/** 保存されている設定を読む。無い・形が違うものは空の設定、読めないページは捨てる。 */
export function parseDescriptionSettings(raw: unknown): DescriptionSettings {
  if (typeof raw !== "object" || raw === null) return { bgm: "", pages: [] };
  const r = raw as { bgm?: unknown; pages?: unknown };
  return { bgm: str(r.bgm), pages: Array.isArray(r.pages) ? r.pages.map(parsePage).filter((p): p is DescriptionPage => p !== null) : [] };
}

/** 保存するときの形(再生用の URL を落とす)。 */
export function toStoredDescription(settings: DescriptionSettings): DescriptionSettings {
  return { bgm: settings.bgm, pages: settings.pages.map(({ imageUrl: _u, ...stored }) => stored) };
}

/** 新しいページの初期値(空のテキスト)。 */
export function newDescriptionPage(): DescriptionPage {
  return { kind: "テキスト", text: "" };
}

/**
 * ページ送り。いまのページ(0始まり)から `delta`(+1 次へ / -1 前へ)だけ動かした結果。
 * 最後のページで次へ進むと leave(説明を終えて次の画面へ)。最初のページより前には戻らない。
 * ページが無いときは、次へで leave。
 */
export type PageStep = { kind: "stay"; index: number } | { kind: "leave" };
/** ページを動かす。{@link PageStep} */
export function stepPage(index: number, total: number, delta: 1 | -1): PageStep {
  if (delta === 1) return index >= total - 1 ? { kind: "leave" } : { kind: "stay", index: index + 1 };
  return { kind: "stay", index: Math.max(0, index - 1) };
}
