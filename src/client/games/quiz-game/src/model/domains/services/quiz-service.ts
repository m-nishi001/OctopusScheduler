import { injectable } from "tsyringe";
import type { Quiz } from "../entities/quiz";
import { QuizAssetRepository } from "../repositories/quiz-asset-repository";

@injectable()
export class QuizService {
  private assetRepo: QuizAssetRepository;

  constructor() {
    this.assetRepo = new QuizAssetRepository();
  }

  getQuizById(id: string): Quiz | null {
    // モック実装: 固定データを返す
    if (id === "1") {
      return {
        id: "1",
        title: "クイズ 1",
        question: "これはサンプルの質問です？",
        options: [
          { text: "はい", color: "#ff0000", imageId: null },
          { text: "いいえ", color: "#00ff00", imageId: null },
          { text: "わからない", color: "#0000ff", imageId: null },
          { text: "どちらでも", color: "#ffff00", imageId: null },
        ],
        formUrl: "https://example.com/form",
        timeLimit: 30,
      };
    }
    return null;
  }

  async saveAsset(blob: Blob): Promise<string> {
    return await this.assetRepo.saveAsset(blob);
  }

  async getAsset(id: string): Promise<Blob | null> {
    return await this.assetRepo.getAsset(id);
  }

  async deleteAsset(id: string): Promise<void> {
    await this.assetRepo.deleteAsset(id);
  }
}
