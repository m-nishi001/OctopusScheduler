import type { Prize } from "../domains/prize/prize";
import type {
  DriveMetadata,
  DriveJsonData,
} from "../../../../../../server/common/src/drive-types";
import { LocalStorageService } from "@common-lib/storage/local-storage-service";
import { GasFunctionService } from "@common-lib/google-apps-script/gas-script-service";
import { injectable, inject } from "tsyringe";
import { IdGeneratorToken } from "../domains/common/id-generator";
import type { IdGenerator } from "../domains/common/id-generator";
import type { IPrizeRepository } from "../domains/prize/repository/i-prize-repository";

@injectable()
export class PrizeRepository implements IPrizeRepository {
  private readonly localStorage = new LocalStorageService(
    "jackpot-game",
    "PrizeData"
  );

  constructor(@inject(IdGeneratorToken) private idGenerator: IdGenerator) {}

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
  }

  async deletePrizes(ids: string[]): Promise<void> {
    await this.localStorage.removeMultiple(ids);
  }

  async replaceAllPrizes(prizes: Prize[]): Promise<{ replaced: number }> {
    // clear existing
    const all = await this.localStorage.getAll<Prize>();
    const keys = Array.from(all.keys());
    if (keys.length) {
      await this.localStorage.removeMultiple(keys);
    }
    // save provided prizes
    for (const prize of prizes) {
      const id =
        prize.id || String(Date.now()) + Math.random().toString(36).slice(2, 8);
      await this.localStorage.save(id, { ...prize, id });
    }
    return { replaced: prizes.length };
  }

  async exportAllPrizesToDrive(): Promise<void> {
    try {
      const prizesToExport = await this.getPrizes();
      const json = JSON.stringify(prizesToExport || []);
      const service = new GasFunctionService("addJson");
      // NOTE: driveDataId is assigned by the GAS side (Drive metadata) when
      // uploading JSON files. The app should manage an application-scoped file
      // identifier (fileId) so we can later re-download the same file.
      const appFileId = this.idGenerator.nextId();

      const driveJson = {
        // Provide an application-scoped id (appFileId) at the top-level
        // so the GAS side can use it as a filename prefix. Do not place
        // application-scoped IDs inside `metadata` — that's Drive-managed.
        appFileId: appFileId,
        // Keep metadata empty: GAS will set/return Drive-specific metadata
        // when it saves the file.
        metadata: {},
        fileName: "prizes.json",
        jsonText: json,
        uploadDate: new Date().toISOString(),
        parentFolderId: "",
      };
      await service.call<DriveMetadata>(driveJson as DriveJsonData);
    } catch (e) {
      console.error("PrizeRepository.exportAllPrizesToDrive failed:", e);
      return;
    }
  }

  async importAllPrizesFromDrive(): Promise<void> {
    try {
      const service = new GasFunctionService("getJson");
      const resp = await service.call<{ json: string }>();
      try {
        const parsed = JSON.parse(resp.json) as Prize[];
        if (!Array.isArray(parsed)) {
          console.warn("Downloaded prizes JSON is not an array");
          throw new Error("Downloaded prizes JSON is not an array");
        }
        await this.replaceAllPrizes(parsed);
        return;
      } catch (e) {
        console.error("Failed to parse downloaded prizes JSON", e);
        throw e;
      }
    } catch (e) {
      console.error("PrizeRepository.importAllPrizesFromDrive failed:", e);
      throw e;
    }
  }
}
