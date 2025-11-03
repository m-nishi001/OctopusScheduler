import { injectable } from "tsyringe";
import type { Quiz } from "../entities/quiz";

@injectable()
export class QuizService {
  getQuizById(id: string): Quiz | null {
    // モック実装: 固定データを返す
    if (id === "1") {
      return {
        id: "1",
        title: "クイズ 1",
        question: "これはサンプルの質問です？",
        options: [
          { text: "はい", color: "#ff0000", image: "" },
          { text: "いいえ", color: "#00ff00", image: "" },
          { text: "わからない", color: "#0000ff", image: "" },
          { text: "どちらでも", color: "#ffff00", image: "" },
        ],
        formUrl: "https://example.com/form",
        spreadsheetUrl: "https://example.com/spreadsheet",
        timeLimit: 30,
      };
    }
    return null;
  }
}
