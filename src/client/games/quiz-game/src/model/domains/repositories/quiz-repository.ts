import { injectable } from "tsyringe";
import { GasFunctionService } from "packages/common-lib/google-apps-script/gas-script-service";
import type { SheetRow } from "@server/quiz-game-api";
import type { Quiz } from "../entities/quiz";
import { QuizAssetRepository } from "./quiz-asset-repository";

@injectable()
export class QuizRepository {
  private assetRepo: QuizAssetRepository;

  constructor() {
    this.assetRepo = new QuizAssetRepository();
  }

  async getQuizById(id: string): Promise<Quiz | null> {
    // モック実装: 固定データを返す
    if (id === "1") {
      const options = [
        { text: "はい", color: "#ff0000", imageId: null },
        { text: "いいえ", color: "#00ff00", imageId: null },
        { text: "わからない", color: "#0000ff", imageId: null },
        { text: "どちらでも", color: "#ffff00", imageId: null },
      ];

      // imageIdからBlobを取得してimageに変換
      const optionsWithBlobs = await Promise.all(
        options.map(async (option) => ({
          text: option.text,
          color: option.color,
          image: option.imageId
            ? await this.assetRepo.getAsset(option.imageId)
            : null,
        }))
      );

      return {
        id: "1",
        title: "クイズ 1",
        question: "これはサンプルの質問です？",
        options: optionsWithBlobs,
        formUrl: "https://example.com/form",
        timeLimit: 30,
        bgm: null,
      };
    }
    return null;
  }

  async addQuiz(quiz: Omit<Quiz, "id">): Promise<string> {
    // GAS関数を呼び出してクイズを追加
    const service = new GasFunctionService("addQuiz");
    return await service.call<string>(quiz);
  }

  async stopForm(quizId: string): Promise<void> {
    const service = new GasFunctionService("stopForm");
    await service.call<void>(quizId);
  }

  async getSheetData(quizId: string): Promise<SheetRow[]> {
    const service = new GasFunctionService("getSheetData");
    return await service.call<SheetRow[]>(quizId);
  }
}
