import { injectable, inject } from "tsyringe";
import type { Result } from "../entities/result";
import { ApiService } from "../../infrastructures/services/api-service";

interface SheetRow {
  name: string;
  time: number;
}

@injectable()
export class ResultAggregationService {
  constructor(@inject(ApiService) private apiService: ApiService) {}

  async aggregateResults(quizId: string): Promise<Result[]> {
    // Form停止
    await this.apiService.stopForm(quizId);
    // Spreadsheetからデータ取得
    const data: SheetRow[] = await this.apiService.getSheetData(quizId);
    // 集計: 名前と時間をResultに変換
    return data.map((row: SheetRow, index: number) => ({
      id: `result-${index}`,
      player: { id: `player-${index}`, name: row.name },
      time: { seconds: row.time },
      rank: index + 1,
    }));
  }
}
