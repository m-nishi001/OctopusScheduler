/**
 * 同期エンジンが扱う「1つの同期対象」の抽象。
 *
 * ローカル/リモートそれぞれの現在値と更新日時を取得できれば、その差分に
 * 応じて SyncRunner が push/pull のどちらか一方を1回だけ呼び出す。
 * 1つの SyncTarget が「1ファイル(または1つのJSONブロブ)につき1リクエスト」
 * に対応する単位になる。
 */
export interface SyncSnapshot<T> {
  data: T;
  updatedAt: number;
}

export interface SyncTarget<TLocal = unknown, TRemote = unknown> {
  /** ローカル/リモートの両側で共有される安定した識別子。 */
  readonly id: string;
  /** 同期対象の種別。並列度ポリシー(IConcurrencyPolicy)の切り替え単位。 */
  readonly kind: string;
  getLocal(): Promise<SyncSnapshot<TLocal> | null>;
  getRemote(): Promise<SyncSnapshot<TRemote> | null>;
  /** ローカル→リモートへ反映する。 */
  push(data: TLocal): Promise<{ updatedAt: number }>;
  /** リモート→ローカルへ反映する。 */
  pull(data: TRemote): Promise<{ updatedAt: number }>;
}

/**
 * あるドメイン(アセット、メンバー一覧など)が持つ SyncTarget の一覧を
 * 提供するもの。各パッケージのリポジトリがこれを実装する。
 */
export interface SyncTargetProvider {
  listTargets(): Promise<SyncTarget[]>;
}
