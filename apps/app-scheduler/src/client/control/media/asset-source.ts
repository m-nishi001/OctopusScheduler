import { inject, injectable } from "tsyringe";
import { AssetRepository } from "@model/asset/asset-repository";

/** 先読みの同時取得数。 */
export const PREFETCH_CONCURRENCY = 3;

/** 先読みする素材 1 件。`fileId` はサーバーの一覧のメタデータの値(あれば、取得のたびの一覧取得を省ける)。 */
export interface PrefetchItem {
  id: string;
  size?: number;
  fileId?: string;
}

/**
 * 素材の取得口。`ensure(id)` が、使える状態の素材(Blob)を必ず返す。
 *   - この端末(IndexedDB)にあれば、それを返す。
 *   - 無ければサーバーから取って保存し、返す。
 * 取得中の Promise は ID ごとに使い回し、二重には取らない。失敗したら外すので、次の呼び出しで取り直せる。
 * 持つ状態は、この取得中の Promise の Map だけ。
 */
@injectable()
export class AssetSource {
  private readonly inflight = new Map<string, Promise<Blob>>();

  constructor(@inject(AssetRepository) private readonly repository: Pick<AssetRepository, "getAssetById" | "pullRemote">) {}

  /** 素材を使える状態にして返す。先読みの列とは別に、呼ばれたらすぐ取りに行く(指示が先読みを飛ばす)。 */
  ensure(id: string, fileId?: string): Promise<Blob> {
    const running = this.inflight.get(id);
    if (running) return running;
    const task = this.load(id, fileId).finally(() => {
      if (this.inflight.get(id) === task) this.inflight.delete(id);
    });
    this.inflight.set(id, task);
    return task;
  }

  /**
   * 素材を、小さいものから同時 {@link PREFETCH_CONCURRENCY} 件ずつ取っておく。
   * 1 件の失敗では止まらない(指示が来たときに `ensure` が取り直す)。
   */
  async prefetchAll(items: readonly PrefetchItem[]): Promise<void> {
    const queue = [...items].sort((a, b) => (a.size ?? Infinity) - (b.size ?? Infinity));
    let next = 0;
    const worker = async () => {
      while (next < queue.length) {
        const item = queue[next++];
        try {
          await this.ensure(item.id, item.fileId);
        } catch (error) {
          console.warn("素材の先読みに失敗しました", item.id, error);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PREFETCH_CONCURRENCY, queue.length) }, worker));
  }

  private async load(id: string, fileId?: string): Promise<Blob> {
    const local = await this.repository.getAssetById(id);
    if (local?.blob && local.blob.size > 0) return local.blob;
    return (await this.repository.pullRemote(id, fileId)).blob;
  }
}
