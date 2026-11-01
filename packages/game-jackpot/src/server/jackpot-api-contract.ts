/**
 * jackpot-game の GAS エンドポイント契約(唯一の正準定義)。
 */
import type { ApiCallOptions } from "@octopus/infrastructures/interfaces";

export const JACKPOT_GAME_PREFIX = "jackpotGame" as const;

export const JACKPOT_GAME_ENDPOINTS = [
  "getRecord",
  "saveRecord",
  "existsBlobs",
  "putBlob",
  "getBlob",
  "addJson",
  "getJson",
] as const;

export type JackpotGameEndpointName = (typeof JACKPOT_GAME_ENDPOINTS)[number];

export type JackpotGameFunctionName =
  `${typeof JACKPOT_GAME_PREFIX}_${JackpotGameEndpointName}`;

/**
 * 景品1件。画像・音声は中身を持たず、素材の名前(ファイル名)で参照する。
 * 名前から中身(ハッシュ)への対応は、レコードの `media`(索引)にある。
 */
export interface Prize {
  id: string;
  name: string;
  /** 当選確率の重み。目安は1〜100で、大きいほど当選しやすい。未設定時は既定値が使われる。 */
  weight?: number;
  image?: string;
  image2?: string;
  bgm1?: string;
  bgm2?: string;
  animation?: string;
  order: number;
  winningImage1?: string;
  winningImage2?: string;
}

/** 画面設定の1項目(画面名・項目名・値)。値は JSON のテキストで、素材は名前で参照する({@link screenMediaNames})。 */
export interface ScreenSettingRecord {
  screenName: string;
  settingName: string;
  settingValue: string;
}

/** 素材1つの情報。ハッシュは `hashBlob` の値(ファイルそのものの内容)。 */
export interface MediaInfo {
  hash: string;
  mime: string;
  size: number;
}

/**
 * 同期するレコードの1件。景品と画面設定をまとめて持つ(景品と画面設定にまたがる素材の参照も、ここで1つに数えられる)。
 * `media` は「景品と画面設定が参照している名前 → 素材」の索引で、保存のたびに作り直す(状態として別に持たない)。
 * 同じ名前は同じ素材として、ジャックポットの中で1つだけ持つ。
 */
export interface JackpotRecord {
  prizes: Prize[];
  screens: ScreenSettingRecord[];
  media: Record<string, MediaInfo>;
}

/** 景品1件が参照している素材の名前(重複・空は含めない)。 */
export function prizeMediaNames(p: Prize): string[] {
  const names = [p.image, p.image2, p.winningImage1, p.winningImage2, p.bgm1, p.bgm2];
  return [...new Set(names.filter((n): n is string => !!n))];
}

/** 値が素材の名前(1つ)である項目。オープニング等の BGM(`bgm`)、コンテンツの画像(`media`)と効果音(`se`)、デモ・結果画面の BGM・効果音。 */
const SCREEN_MEDIA_KEYS: ReadonlySet<string> = new Set([
  "bgm", "media", "se", "demoBgm", "demoSe1", "demoSe2", "resultBgm", "resultSe1", "resultSe2",
]);
/** 値が素材の名前の配列である項目(本抽選のメンバー抽選 BGM)。 */
const SCREEN_MEDIA_LIST_KEYS: ReadonlySet<string> = new Set(["memberLotteryBgms"]);

/** 画面設定1項目が参照している素材の名前(重複・空は含めない)。値が JSON でなければ何も参照していない。 */
export function screenMediaNames(s: ScreenSettingRecord): string[] {
  let value: unknown;
  try {
    value = JSON.parse(s.settingValue);
  } catch {
    return [];
  }
  const names = new Set<string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    for (const [key, child] of Object.entries(v)) {
      if (SCREEN_MEDIA_KEYS.has(key) && typeof child === "string") names.add(child);
      else if (SCREEN_MEDIA_LIST_KEYS.has(key) && Array.isArray(child)) child.forEach((n) => typeof n === "string" && names.add(n));
      else walk(child);
    }
  };
  walk(value);
  names.delete("");
  return [...names];
}

/** 景品と画面設定が参照している素材の名前の、1件ごとのまとまり(索引を作り直す `deriveMedia` に渡す)。 */
export const jackpotMediaRefs = (r: Pick<JackpotRecord, "prizes" | "screens">): string[][] => [
  ...r.prizes.map(prizeMediaNames),
  ...r.screens.map(screenMediaNames),
];

/** 景品と画面設定のレコードのサーバー上の名前。 */
export const JACKPOT_RECORD_FILE = "jackpot-config.json";

/** 同期の `{ updatedAt, data }` のテキスト1件の保存(ファイル名はサーバー側の保存先の名前)。 */
export interface JsonBlobWrite {
  fileName: string;
  json: string;
}

/** レコードが参照するハッシュは、索引 `media` の値。形が違っても例外にしない(その場合は何も参照していない)。 */
export function jackpotRecordHashes(data: unknown): string[] {
  const media = (data as Partial<JackpotRecord> | null)?.media;
  if (!media || typeof media !== "object") return [];
  return Object.values(media).flatMap((m) => (typeof m?.hash === "string" ? [m.hash] : []));
}

/**
 * クライアントが直接呼び出せる型付きAPI。`createTypedApiClient()` で生成される
 * Proxyの型として使う。各メソッドの引数・戻り値は `server/endpoints.ts` と
 * その先の use-case 実装の実際のシグネチャに合わせている。
 */
export interface JackpotGameApi {
  /** 景品・画面設定のレコードのテキストをそのまま返す。まだ保存されていなければ json は null。 */
  getRecord(args?: undefined, options?: ApiCallOptions): Promise<{ json: string | null }>;
  /** レコード(`{ updatedAt, data }` のテキスト)を保存する。参照先のファイルが無ければ断り、レコードから外れたファイルを消す。 */
  saveRecord(args: { json: string }, options?: ApiCallOptions): Promise<void>;
  existsBlobs(args: { hashes: string[] }, options?: ApiCallOptions): Promise<{ existing: string[] }>;
  putBlob(args: { hash: string; dataUrl: string }, options?: ApiCallOptions): Promise<void>;
  getBlob(args: { hash: string }, options?: ApiCallOptions): Promise<{ dataUrl: string | null }>;
  /** 同期の `{ updatedAt, data }` のテキストを、中身を見ずにそのまま保存する(メンバーの拡張設定)。 */
  addJson(blob: JsonBlobWrite, options?: ApiCallOptions): Promise<void>;
  /** 保存してあるテキストをそのまま返す。まだ保存されていなければ json は null。 */
  getJson(fileName: string, options?: ApiCallOptions): Promise<{ json: string | null }>;
}

/** `JackpotGameApi` をDI解決するためのトークン。 */
export const IJackpotGameApiToken = Symbol("IJackpotGameApi");
