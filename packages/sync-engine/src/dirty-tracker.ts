/**
 * 「前回のプッシュ以降にローカルで変更があったか」を種別(kind)ごとに記録する
 * 軽量な台帳。
 *
 * JSONブロブ全体を1つの同期対象として扱うドメイン(メンバー一覧、賞品、
 * クイズ一覧など)は個々のレコードに更新日時を持たないため、変更系メソッドが
 * touch() を呼ぶことでローカル側の更新日時を得る。これによりバックグラウンド
 * push側は「dirtyな対象だけ」を差分計算せずに同期できる。
 */
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";

export class DirtyTracker {
  private readonly storage: LocalStorageService;

  constructor(namespace: string) {
    this.storage = new LocalStorageService(namespace, "SyncDirtyTracker");
  }

  /** 指定した kind を「今変更された」として記録し、その更新日時を返す。 */
  async touch(kind: string): Promise<number> {
    const updatedAt = Date.now();
    await this.storage.save(kind, updatedAt);
    return updatedAt;
  }

  /** 指定した kind の最終変更日時。一度も touch されていなければ null。 */
  async getUpdatedAt(kind: string): Promise<number | null> {
    const value = await this.storage.get<number>(kind);
    return value ?? null;
  }
}
