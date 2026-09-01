import { injectable, inject } from "tsyringe";
import type { ResultDto } from "../dtos/result-dto";
import { ResultService } from "../../domains/services/result-service";
import { FormRepository } from "../../domains/repositories/form-repository";
import type { SheetRow } from "quiz-game-api";

@injectable()
export class GetResultsUseCase {
  constructor(
    @inject(FormRepository) private formRepository: FormRepository,
    @inject(ResultService) private resultService: ResultService
  ) {}

  async execute(quizId: string): Promise<ResultDto[]> {
    const data: SheetRow[] = await this.formRepository.getSheetData(quizId);
    const results = this.resultService.processResults(data);
    return results.map((result) => ({
      id: result.id,
      playerName: result.playerName,
      time: result.time,
      rank: result.rank,
    }));
  }
}
