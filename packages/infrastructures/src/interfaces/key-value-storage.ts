/**
 * キー付き永続データストアの抽象化(GASでは PropertiesService + Drive)。
 *
 * 「フォルダ」「ファイル」のようなDrive固有の概念はこの契約に持たせない。
 * 全てのデータは文字列キーで指し示す。名前空間分けが必要な場合は
 * `"<namespace>/<localName>"` という呼び出し側の規約でキーを組み立てる
 * (実際の分割規約は compositions/item-key-naming.ts に集約する)。
 */

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

export interface IKeyValueStorage {
  /** 単純な文字列値を読む。 */
  get(key: string): Promise<string | null>;

  /** 単純な文字列値を書く。 */
  set(key: string, value: string): Promise<void>;

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
