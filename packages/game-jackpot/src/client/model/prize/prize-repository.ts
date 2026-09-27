import type { Prize } from "./prize";
import type { DriveJsonData } from "@octopus/infrastructures/compositions";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { DirtyTracker } from "@octopus/sync-engine";
import type { SyncTarget } from "@octopus/sync-engine";
import { IJackpotGameApiToken } from "../../../server/jackpot-api-contract";
import type { JackpotGameApi } from "../../../server/jackpot-api-contract";
import { injectable, inject } from "tsyringe";

const SYNC_KIND = "prizes";
// getJsonBlobのフォールバック実装が既定ファイルとして解決できるよう、
// appFileIdは付けず常にこのファイル名そのものを使う(prizes.json)。
const DRIVE_FILE_NAME = "prizes.json";

@injectable()
export class PrizeRepository {
  private readonly localStorage = new LocalStorageService(
    "jackpot-game",
    "PrizeData"
  );
  private readonly dirtyTracker = new DirtyTracker("jackpot-game");

  constructor(
    @inject(IJackpotGameApiToken) private readonly jackpotApi: JackpotGameApi
  ) {}

  async getPrizes(): Promise<Prize[]> {
    const allPrizes = await this.localStorage.getAll<Prize>();
    return Array.from(allPrizes.values());
  }

  async getPrizeById(id: string): Promise<Prize | null> {
    return (await this.localStorage.get<Prize>(id)) || null;
  }

  async addPrizes(prizes: Prize[]): Promise<void> {
    for (const prize of prizes) {
      await this.localStorage.save(prize.id, prize);
    }
    await this.dirtyTracker.touch(SYNC_KIND);
    eventBus.emit("syncDirty");
  }

  async deletePrizes(ids: string[]): Promise<void> {
    await this.localStorage.removeMultiple(ids);
    await this.dirtyTracker.touch(SYNC_KIND);
    eventBus.emit("syncDirty");
  }

  async replaceAllPrizes(prizes: Prize[]): Promise<{ replaced: number }> {
    const all = await this.localStorage.getAll<Prize>();
    const keys = Array.from(all.keys());
    if (keys.length) {
      await this.localStorage.removeMultiple(keys);
    }
    for (const prize of prizes) {
      const id =
        prize.id || String(Date.now()) + Math.random().toString(36).slice(2, 8);
      await this.localStorage.save(id, { ...prize, id });
    }
    return { replaced: prizes.length };
  }

  /**
   * バックグラウンド同期エンジン向けに、景品一覧全体を1つのSyncTargetとして
   * 返す(GAS側はJSON blobとしてしか保存しないため、景品単位ではなく
   * ドメイン全体を1つの対象として扱う)。
   */
  async listSyncTargets(): Promise<SyncTarget<Prize[], Prize[]>[]> {
    const target: SyncTarget<Prize[], Prize[]> = {
      id: SYNC_KIND,
      kind: SYNC_KIND,
      getLocal: async () => {
        const prizes = await this.getPrizes();
        if (prizes.length === 0) return null;
        const trackedAt = await this.dirtyTracker.getUpdatedAt(SYNC_KIND);
        return { data: prizes, updatedAt: trackedAt ?? Date.now() };
      },
      getRemote: async () => {
        let resp;
        try {
          resp = await this.jackpotApi.getJson();
        } catch (e) {
          console.error(
            "[PrizeRepository] Failed to fetch remote prizes for sync",
            e
          );
          return null;
        }
        let parsed: Prize[];
        try {
          parsed = JSON.parse(resp.json) as Prize[];
        } catch {
          return null;
        }
        if (!Array.isArray(parsed) || parsed.length === 0) return null;
        const updatedAt = resp.updatedAt ? new Date(resp.updatedAt).getTime() : 0;
        return { data: parsed, updatedAt };
      },
      push: async (prizes) => {
        const driveJson: DriveJsonData = {
          metadata: {} as any,
          fileName: DRIVE_FILE_NAME,
          jsonText: JSON.stringify(prizes),
          uploadDate: new Date().toISOString(),
          parentFolderId: "",
        };
        const meta = await this.jackpotApi.addJson(driveJson);
        const updatedAt = meta?.lastUpdate
          ? new Date(meta.lastUpdate).getTime()
          : Date.now();
        await this.dirtyTracker.touch(SYNC_KIND, updatedAt);
        return { updatedAt };
      },
      pull: async (prizes) => {
        await this.replaceAllPrizes(prizes);
        const updatedAt = Date.now();
        await this.dirtyTracker.touch(SYNC_KIND, updatedAt);
        return { updatedAt };
      },
    };
    return [target];
  }
}
