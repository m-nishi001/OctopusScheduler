import { injectable } from "tsyringe";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import type { IQuizAssetRepository } from "../domains/repositories/i-quiz-asset-repository";

@injectable()
export class QuizAssetRepository implements IQuizAssetRepository {
  private readonly localStorage: LocalStorageService;

  constructor() {
    this.localStorage = new LocalStorageService("quiz-game", "QuizAssets");
  }

  async saveAsset(blob: Blob): Promise<string> {
    const id = crypto.randomUUID();
    await this.localStorage.save(id, blob);
    return id;
  }

  async getAsset(id: string): Promise<Blob | null> {
    return (await this.localStorage.get<Blob>(id)) || null;
  }

  async deleteAsset(id: string): Promise<void> {
    await this.localStorage.removeMultiple([id]);
  }

  async getAllAssets(): Promise<Map<string, Blob>> {
    return await this.localStorage.getAll<Blob>();
  }
}
