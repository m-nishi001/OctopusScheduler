/**
 * キー付き永続データストアの抽象化(GASでは PropertiesService + Drive)。
 *
 * 「フォルダ」「ファイル」のようなDrive固有の概念はこの契約に持たせない。
 * 全てのデータは文字列キーで指し示す。名前空間分けが必要な場合は
 * `"<namespace>/<localName>"` という呼び出し側の規約でキーを組み立てる
 * (実際の分割規約は compositions/item-key-naming.ts に集約する)。
 */
import { DomainError } from "./domain-error";

export interface StoredItemMeta {
  key: string;
  mimeType: string;
  size?: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoredItemContent {
  meta: StoredItemMeta;
  contentBase64: string;
}

/** 文字列を UTF-8 で保存したときのバイト数(日本語は 1 文字 3 バイト)。保存先の容量の判定に使う。 */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4; // サロゲートペア(絵文字など)は 2 単位で 4 バイト
      i++;
    } else bytes += 3;
  }
  return bytes;
}

export interface IKeyValueStorage {
  /**
   * 文字列値 1 件に保存できる上限(バイト数)。上限のある保存先(GAS)だけが持つ。
   * 呼び出し側は、これを超えそうな値を作らないよう件数を抑える(超えると `set` が {@link StorageCapacityError})。
   */
  readonly maxScalarBytes?: number;

  /** 単純な文字列値を読む。 */
  get(key: string): Promise<string | null>;

  /** 単純な文字列値を書く。 */
  set(key: string, value: string): Promise<void>;

  /** 単純な文字列値を削除する(無ければ何もしない)。 */
  deleteScalar(key: string): Promise<void>;

  /** prefix から始まる単純な文字列値をすべて削除する(終わったセッションの掃除用)。削除した件数を返す。 */
  deleteScalarsByPrefix(prefix: string): Promise<number>;

  /** プレーンテキスト(JSON等)を key に書く(既存があれば上書き)。 */
  putText(key: string, content: string, mimeType: string): Promise<StoredItemMeta>;

  /** バイナリセーフな内容(base64)を key に書く(既存があれば上書き)。 */
  putBinary(key: string, contentBase64: string, mimeType: string): Promise<StoredItemMeta>;

  /** key の内容をメタデータ付きで取得する。存在しない場合は null。 */
  getContent(key: string): Promise<StoredItemContent | null>;

  /** key の内容を文字列として取得する。存在しない場合は null。 */
  getContentAsText(key: string): Promise<string | null>;

  /** 内容を取得せず、メタデータのみ取得する。存在しない場合は null。 */
  stat(key: string): Promise<StoredItemMeta | null>;

  /** prefix から始まるキーのメタデータ一覧を返す。 */
  listByPrefix(prefix: string): Promise<StoredItemMeta[]>;

  /** key を削除し、削除前のメタデータを返す。存在しない場合は null。 */
  delete(key: string): Promise<StoredItemMeta | null>;
}

export const IKeyValueStorageToken = Symbol("IKeyValueStorage");

/**
 * ストレージの保存先ルートが未設定(GAS の ScriptProperty 未登録など)であることを示す。
 * 利用側で握りつぶさず、呼び出し元へ通知するための専用エラー。
 */
export class StorageNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageNotConfiguredError";
  }
}

/**
 * 保存先の容量の上限を超えた(GAS の ScriptProperty は 1 値 約 9KB・全体 約 500KB)。
 * リトライしても結果が変わらないので DomainError にし、画面に分かる文言で伝える。
 */
export class StorageCapacityError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "StorageCapacityError";
  }
}
