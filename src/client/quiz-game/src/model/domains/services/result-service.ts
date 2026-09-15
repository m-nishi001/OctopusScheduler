import { injectable } from "tsyringe";
import type { Result } from "../entities/result";
import type { SheetRow } from "quiz-game-api";

@injectable()
export class ResultService {
  processResults(data: SheetRow[]): Result[] {
    return data.map((row: SheetRow, index: number) => ({
      id: `result-${index}`,
      playerName: row.name,
      time: row.time,
      rank: index + 1,
    }));
  }
}
