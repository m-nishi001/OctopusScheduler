import type { Prize } from "./prize";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { BlobRecordStore, blobRecordSyncTarget, textBlobRecordRemote } from "@octopus/sync-engine";
import type { SyncTarget } from "@octopus/sync-engine";
import { IJackpotGameApiToken } from "../../../server/jackpot-api-contract";
import type { JackpotGameApi } from "../../../server/jackpot-api-contract";
import { injectable, inject } from "tsyringe";

const SYNC_KIND = "prizes";
const DRIVE_FILE_NAME = "prizes.json";

/** 景品の保存先。この端末(IndexedDB)に一覧全体を1件のレコード `{ data, updatedAt }` で持ち、バックグラウンド同期の対象として Drive / R2 と新しいほうに揃える。 */
@injectable()
export class PrizeRepository {
  private readonly store = new BlobRecordStore<Prize[]>("jackpot-game", "PrizeData");

  constructor(
    @inject(IJackpotGameApiToken) private readonly jackpotApi: JackpotGameApi
  ) {}

  async getPrizes(): Promise<Prize[]> {
    return (await this.store.read())?.data ?? [];
  }

  async getPrizeById(id: string): Promise<Prize | null> {
    return (await this.getPrizes()).find((p) => p.id === id) ?? null;
  }

  async addPrizes(prizes: Prize[]): Promise<void> {
    await this.store.update((current) => {
      const byId = new Map((current ?? []).map((p) => [p.id, p] as const));
      for (const prize of prizes) byId.set(prize.id, prize);
      return Array.from(byId.values());
    });
    eventBus.emit("syncDirty");
  }

  async deletePrizes(ids: string[]): Promise<void> {
    await this.store.update((current) => (current ?? []).filter((p) => !ids.includes(p.id)));
    eventBus.emit("syncDirty");
  }

  /**
   * バックグラウンド同期エンジン向けに、景品一覧全体を1つのSyncTargetとして
   * 返す(GAS側はJSON blobとしてしか保存しないため、景品単位ではなく
   * ドメイン全体を1つの対象として扱う)。
   */
  async listSyncTargets(): Promise<SyncTarget<Prize[], Prize[]>[]> {
    return [
      blobRecordSyncTarget(
        SYNC_KIND,
        this.store,
        textBlobRecordRemote<Prize[]>({
          read: async () => (await this.jackpotApi.getJson(DRIVE_FILE_NAME)).json,
          write: (json) => this.jackpotApi.addJson({ fileName: DRIVE_FILE_NAME, json }),
        })
      ),
    ];
  }
}
