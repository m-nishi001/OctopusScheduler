import { injectable, inject } from "tsyringe";
import type { Result } from "../entities/result";
import { QuizRepository } from "../repositories/quiz-repository";

interface SheetRow {
  name: string;
  time: number;
}

@injectable()
export class ResultService {
  constructor(@inject(QuizRepository) private quizRepository: QuizRepository) {}

  async aggregateResults(quizId: string): Promise<Result[]> {
    // Form停止
    await this.quizRepository.stopForm(quizId);
    // Spreadsheetからデータ取得
    const data: SheetRow[] = await this.quizRepository.getSheetData(quizId);
    // 集計: 名前と時間をResultに変換
    return data.map((row: SheetRow, index: number) => ({
      id: `result-${index}`,
      playerName: row.name,
      time: row.time,
      rank: index + 1,
    }));
  }
}
