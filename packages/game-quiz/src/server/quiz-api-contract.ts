/**
 * quiz-game の GAS エンドポイント契約(唯一の正準定義)。
 *
 * クライアント(client/model/domains/repositories)とサーバー(server/endpoints.ts)の
 * 両方がここから型を参照する。エンドポイント名一覧は infrastructures/gas の
 * esbuild banner/footer コード生成、および scripts/gas-contract.js の集約対象になる。
 */
import type { ApiCallOptions } from "@octopus/infrastructures/interfaces";

export const QUIZ_GAME_PREFIX = "quizGame" as const;

export const QUIZ_GAME_ENDPOINTS = [
  "getRecord",
  "saveRecord",
  "existsBlobs",
  "putBlob",
  "getBlob",
] as const;

export type QuizGameEndpointName = (typeof QUIZ_GAME_ENDPOINTS)[number];

export type QuizGameFunctionName =
  `${typeof QUIZ_GAME_PREFIX}_${QuizGameEndpointName}`;

/**
 * 一覧(レコード)に載せるクイズ1件。画像・音声は中身を持たず、内容のハッシュ(`hashBlob`)で参照する。
 * 一覧が正で、ハッシュのファイルは一覧から参照されている間だけサーバーに残る。
 */
export interface QuizRecordEntry {
  id: string;
  title: string;
  question: string;
  options: { no: number; text: string; color: string; image: string | null }[];
  correctNo: number;
  timeLimit: number;
  bgm: string | null;
  settings?: {
    correctBgm: string | null;
    prizeImage: string | null;
    prizeName: string;
    prizeBgm: string | null;
  };
}

/** 一覧のサーバー上の名前。 */
export const QUIZ_RECORD_FILE = "quiz-list.json";

export interface PutBlobArgs {
  hash: string;
  dataUrl: string;
}

export interface ExistsBlobsArgs {
  hashes: string[];
}

export interface GetBlobArgs {
  hash: string;
}

export interface SaveRecordArgs {
  json: string;
}

/** 一覧が参照するハッシュ(画像・音声)。一覧の形が違っても例外にしない(その場合は何も参照していない)。 */
export function quizRecordHashes(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  const hashes: string[] = [];
  for (const entry of data as Partial<QuizRecordEntry>[]) {
    for (const o of entry?.options ?? []) if (o?.image) hashes.push(o.image);
    if (entry?.bgm) hashes.push(entry.bgm);
    const s = entry?.settings;
    for (const h of [s?.correctBgm, s?.prizeImage, s?.prizeBgm]) if (h) hashes.push(h);
  }
  return hashes;
}

/**
 * クイズの1回の実施を本番(live)とデモ(demo)に分ける区分。回答ラウンドのキーに含めるため、
 * デモ実行が本番の回答に影響しない。
 */
export type QuizSessionScope = "live" | "demo";

/**
 * クライアントが直接呼び出せる型付きAPI。`createTypedApiClient()` で生成される
 * Proxyの型として使う。各メソッドの引数・戻り値は `server/endpoints.ts` の実際のシグネチャに合わせている。
 */
export interface QuizGameApi {
  /** 保存してある一覧のテキストをそのまま返す。まだ保存されていなければ json は null。 */
  getRecord(args: Record<string, never>, options?: ApiCallOptions): Promise<{ json: string | null }>;
  /** 一覧(`{ updatedAt, data }` のテキスト)を保存する。参照先のファイルが無ければ断り、一覧から外れたファイルを消す。 */
  saveRecord(args: SaveRecordArgs, options?: ApiCallOptions): Promise<void>;
  /** 渡したハッシュのうち、サーバーにあるもの。 */
  existsBlobs(args: ExistsBlobsArgs, options?: ApiCallOptions): Promise<{ existing: string[] }>;
  putBlob(args: PutBlobArgs, options?: ApiCallOptions): Promise<void>;
  /** ファイルの中身(データURL)。無ければ null。 */
  getBlob(args: GetBlobArgs, options?: ApiCallOptions): Promise<{ dataUrl: string | null }>;
}

/** `QuizGameApi` をDI解決するためのトークン。 */
export const IQuizGameApiToken = Symbol("IQuizGameApi");
