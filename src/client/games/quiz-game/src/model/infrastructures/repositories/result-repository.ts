import { injectable } from "tsyringe";
import type { Result } from "../../domains/entities/result";
import { LocalStorageService } from "@common-lib/storage/local-storage-service";

@injectable()
export class ResultRepository {
  private readonly localStorage = new LocalStorageService(
    "quiz-game",
    "ResultData"
  );

  async getResults(): Promise<Result[]> {
    const allResults = await this.localStorage.getAll<Result>();
    return Array.from(allResults.values());
  }

  async saveResult(result: Result): Promise<void> {
    await this.localStorage.save(result.id, result);
  }
}
