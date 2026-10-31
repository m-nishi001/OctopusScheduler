/**
 * 顔写真の端末内キャッシュ。写真の ID は中身のハッシュで、同じ ID なら中身は変わらないので、
 * 一度取った写真は捨てる判断をせずに使い回せる(メモリ + IndexedDB)。
 *
 * - 取りに行くときは最大10枚をまとめて1回で取る(会場の共有 IP でもリクエストが膨らまない)。
 * - 同じ写真を同時に何度頼まれても、取りに行くのは1回(読み込み中のものに相乗りする)。
 * - 取得に失敗した写真は「まだ無い」ままにして、次の機会に取り直す。サーバーに無かった写真は、この画面を閉じるまで探し直さない。
 */
import { mapPool } from "@octopus/sync-engine/pool/promise-pool";

/** `getMemberPhotos` が一度に返せる枚数。サーバーの上限(MAX_PHOTOS_PER_READ)に合わせる。 */
export const PHOTOS_PER_READ = 10;

/** 写真を取りに行く先。 */
export interface MemberPhotoSource {
  /** ハッシュ → データURL。保存されていないハッシュは含めない。 */
  fetchPhotos(hashes: string[]): Promise<Record<string, string>>;
}

/** 端末への保存先(IndexedDB)。 */
export interface MemberPhotoStore {
  get(hash: string): Promise<string | undefined>;
  save(hash: string, dataUrl: string): Promise<void>;
}

export interface MemberPhotoCacheOptions {
  /** 端末への保存先。省略時はメモリだけ。 */
  store?: MemberPhotoStore;
  /** まとめて取る枚数。既定は {@link PHOTOS_PER_READ}。 */
  batchSize?: number;
  /** 読み取りの同時実行数。既定は3。 */
  concurrency?: number;
}

/** 顔写真のキャッシュ本体。 */
export class MemberPhotoCache {
  private readonly urls = new Map<string, string>();
  private readonly missing = new Set<string>();
  private readonly loading = new Map<string, Promise<void>>();
  private readonly batchSize: number;
  private readonly concurrency: number;
  private readonly store?: MemberPhotoStore;

  constructor(
    private readonly source: MemberPhotoSource,
    options: MemberPhotoCacheOptions = {}
  ) {
    this.store = options.store;
    this.batchSize = options.batchSize ?? PHOTOS_PER_READ;
    this.concurrency = options.concurrency ?? 3;
  }

  /** 表示に使うデータURL。まだ取れていない・写真が無いときは undefined。 */
  get(hash: string | undefined): string | undefined {
    return hash ? this.urls.get(hash) : undefined;
  }

  /** 画面で今アップロードした写真など、中身が手元にあるものを入れる(取りに行かせない)。 */
  async remember(hash: string, dataUrl: string): Promise<void> {
    this.urls.set(hash, dataUrl);
    this.missing.delete(hash);
    await this.persist(hash, dataUrl);
  }

  /** 指定した写真を取り込む(取得済み・取得中は何もしない)。失敗しても例外にはしない(写真は飾りなので、画面は止めない)。 */
  async ensure(hashes: ReadonlyArray<string | undefined>): Promise<void> {
    const wanted = [...new Set(hashes.filter((h): h is string => !!h))].filter((h) => !this.urls.has(h) && !this.missing.has(h));
    const mine = wanted.filter((h) => !this.loading.has(h));
    if (mine.length > 0) {
      const job = this.load(mine).finally(() => mine.forEach((h) => this.loading.delete(h)));
      mine.forEach((h) => this.loading.set(h, job));
    }
    await Promise.all(wanted.map((h) => this.loading.get(h)));
  }

  private async load(hashes: string[]): Promise<void> {
    await Promise.all(
      hashes.map(async (hash) => {
        const stored = await this.readStored(hash);
        if (stored) this.urls.set(hash, stored);
      })
    );
    const remote = hashes.filter((h) => !this.urls.has(h));
    const batches: string[][] = [];
    for (let i = 0; i < remote.length; i += this.batchSize) batches.push(remote.slice(i, i + this.batchSize));
    try {
      await mapPool(
        batches,
        async (batch) => {
          const photos = await this.source.fetchPhotos(batch);
          for (const hash of batch) {
            const dataUrl = photos[hash];
            if (dataUrl) {
              this.urls.set(hash, dataUrl);
              await this.persist(hash, dataUrl);
            } else {
              this.missing.add(hash);
            }
          }
        },
        { concurrency: this.concurrency }
      );
    } catch (error) {
      console.warn("[MemberPhotoCache] failed to load photos", error);
    }
  }

  private async readStored(hash: string): Promise<string | undefined> {
    try {
      return await this.store?.get(hash);
    } catch {
      return undefined;
    }
  }

  private async persist(hash: string, dataUrl: string): Promise<void> {
    try {
      await this.store?.save(hash, dataUrl);
    } catch (error) {
      // 保存に失敗しても、次回は取り直すだけ。
      console.warn("[MemberPhotoCache] failed to persist photo", error);
    }
  }
}
