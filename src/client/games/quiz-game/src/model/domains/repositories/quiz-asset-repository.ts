import { LocalStorageService } from "packages/common-lib/storage/local-storage-service";

export class QuizAssetRepository {
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
