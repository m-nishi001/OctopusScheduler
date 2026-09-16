/**
 * GAS（Google Apps Script）エンドポイントの**唯一の正準定義**。
 *
 * 背景:
 * - GAS の `google.script.run` はトップレベル関数しか呼べず、型情報を持たない。
 *   そのため呼び出し名は長らく文字列リテラルとしてクライアント側に散っていた。
 * - 結果として「サーバに存在しない関数を呼ぶ」不整合が tsc では検出できなかった。
 *
 * 方針:
 * - クライアントが呼べる関数名をここで一元的に定義し、`GasFunctionName` として型にする。
 * - サーバ側の esbuild 設定はこの定義からグローバル関数をコード生成する（手書きの列挙を廃止）。
 * - これにより「クライアントの呼び出し名」と「サーバの公開名」が同じ定義を参照する。
 *
 * 注意:
 * - キーは各パッケージ名から `-api` を除いた camelCase（esbuild の接頭辞と一致させる必要がある）。
 * - 値はサーバ側のハンドラ名（接頭辞を除いた部分）。
 */
export const GAS_ENDPOINTS = {
  /** `src/server/octopus-scheduler-api` 由来。ホストアプリの中核 API。 */
  octopusScheduler: [
    "doGet",
    "addDriveData",
    "getDriveMetaData",
    "getDriveData",
    "updateDriveData",
    "getKeyboardShortcuts",
    "setKeyboardShortcuts",
  ],
  /** `src/server/jackpot-game-api` 由来。 */
  jackpotGame: [
    "addDriveData",
    "getDriveMetaData",
    "getDriveData",
    "addJson",
    "getJson",
  ],
  /** `src/server/quiz-game-api` 由来。Google Form 連携を含む。 */
  quizGame: [
    "stopForm",
    "getSheetData",
    "stopAndGetProcessedResults",
    "loadEmailNameMap",
    "getMappedResponses",
    "addDriveData",
    "getDriveMetaData",
    "getDriveData",
    "removeDriveData",
    "addJson",
    "getJson",
    "listJsonMetaData",
  ],
} as const;

/**
 * 接頭辞を付けずトップレベル関数として公開する関数。
 *
 * GAS の Web アプリは `doGet` を特別なエントリポイントとして要求するため、
 * `octopusScheduler_doGet` ではなく素の `doGet` として公開する必要がある。
 */
export const GAS_UNPREFIXED_ENDPOINTS = ["doGet"] as const;

type Unprefixed = (typeof GAS_UNPREFIXED_ENDPOINTS)[number];

/** 接頭辞込みの公開関数名から、接頭辞なしで公開するものを除いたもの。 */
type PrefixedName<P extends keyof typeof GAS_ENDPOINTS> = Exclude<
  (typeof GAS_ENDPOINTS)[P][number],
  Unprefixed
>;

/**
 * サーバが公開する GAS グローバル関数名の完全な集合。
 *
 * 例: `"octopusScheduler_getDriveData"` / `"quizGame_stopForm"` / `"doGet"`
 */
export type GasFunctionName = {
  [P in keyof typeof GAS_ENDPOINTS]: `${P & string}_${PrefixedName<P> & string}`;
}[keyof typeof GAS_ENDPOINTS];

/** 接頭辞を持つ関数名のみの集合（`doGet` を含まない）。 */
export type PrefixedGasFunctionName = Extract<
  GasFunctionName,
  `${string}_${string}`
>;

/** `GAS_ENDPOINTS` のキー（＝サーバパッケージ由来の接頭辞）。 */
export type GasFunctionPrefix = keyof typeof GAS_ENDPOINTS;