import { injectable, inject } from "tsyringe";
import type { Result } from "../entities/result";
import { QuizRepository } from "../repositories/quiz-repository";

interface SheetRow {
  name: string;
  time: number;
}

@injectable()
export class ResultAggregationService {
  constructor(@inject(QuizRepository) private quizRepository: QuizRepository) {}

  async aggregateResults(quizId: string): Promise<Result[]> {
    // Form停止
    await this.quizRepository.stopForm(quizId);
    // Spreadsheetからデータ取得
    const data: SheetRow[] = await this.quizRepository.getSheetData(quizId);
    // 集計: 名前と時間をResultに変換
    return data.map((row: SheetRow, index: number) => ({
      id: `result-${index}`,
      player: { id: `player-${index}`, name: row.name },
      time: { seconds: row.time },
      rank: index + 1,
    }));
  }
}
