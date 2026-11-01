import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import type { SyncSnapshot } from "./sync-target";

/** 1件のレコード `{ data, updatedAt }` を読み書きするローカル側の保存先(同期の対象を、種類ごとに1件で持つ)。 */
export interface BlobRecordLocalStore<T> {
  /** 保存されているレコード。一度も保存していなければ null(空の一覧 `[]` とは区別される)。 */
  read(): Promise<SyncSnapshot<T> | null>;
  /** いまの更新日時が `expectedUpdatedAt`(無ければ null)のままなら `next` をそのまま書く。変わっていたら書かずに false。 */
  replaceIfUnchanged(expectedUpdatedAt: number | null, next: SyncSnapshot<T>): Promise<boolean>;
}

const RECORD_KEY = "record";
/** 同じ保存先への読み書きを順番に並べるための待ち行列(保存先ごと)。 */
const queues = new Map<string, Promise<unknown>>();

/**
 * この端末(IndexedDB)に、データと最終更新日時を1つのレコードとして持つ。
 * 編集は「データと更新日時を一緒に1回で書く」だけで、サーバーの時刻を書き戻すことはない。
 * 更新日時は `max(いま, 前の更新日時 + 1)`。編集は必ず元にした版より新しくなり、端末の時計がずれていても負けない。
 */
export class BlobRecordStore<T> implements BlobRecordLocalStore<T> {
  private readonly storage: LocalStorageService;
  private readonly queueKey: string;

  constructor(dbName: string, storeName: string) {
    this.storage = new LocalStorageService(dbName, storeName);
    this.queueKey = `${dbName}/${storeName}`;
  }

  /** 読み書きを1つずつ順に実行する(読んでから書くまでの間に、別の書き込みが割り込まないように)。 */
  private enqueue<R>(task: () => Promise<R>): Promise<R> {
    const prev = queues.get(this.queueKey) ?? Promise.resolve();
    const run = prev.then(task, task);
    queues.set(
      this.queueKey,
      run.catch(() => undefined)
    );
    return run;
  }

  private async readNow(): Promise<SyncSnapshot<T> | null> {
    return (await this.storage.get<SyncSnapshot<T>>(RECORD_KEY)) ?? null;
  }

  read(): Promise<SyncSnapshot<T> | null> {
    return this.enqueue(() => this.readNow());
  }

  /** 現在のデータ(無ければ null)から新しいデータを作って保存する。保存したレコードを返す。 */
  update(change: (current: T | null) => T): Promise<SyncSnapshot<T>> {
    return this.enqueue(async () => {
      const current = await this.readNow();
      const next: SyncSnapshot<T> = {
        data: change(current?.data ?? null),
        updatedAt: Math.max(Date.now(), (current?.updatedAt ?? 0) + 1),
      };
      await this.storage.save(RECORD_KEY, next);
      return next;
    });
  }

  /**
   * 以前の形式(キーごとの行)が同じ保存先に残っていれば消す。一覧のレコード以外の行を、すべて消す。
   * (保存先の名前は以前と同じにして、既存のデータベースにストアを足さない。足すと、別のコードが同じデータベースを開く最中に競合しやすい。)
   */
  purgeOtherRows(): Promise<void> {
    return this.enqueue(async () => {
      const keys = await this.storage.keys();
      await this.storage.removeMultiple(keys.filter((key) => key !== RECORD_KEY));
    });
  }

  replaceIfUnchanged(expectedUpdatedAt: number | null, next: SyncSnapshot<T>): Promise<boolean> {
    return this.enqueue(async () => {
      const current = await this.readNow();
      if ((current?.updatedAt ?? null) !== expectedUpdatedAt) return false;
      await this.storage.save(RECORD_KEY, next);
      return true;
    });
  }
}
