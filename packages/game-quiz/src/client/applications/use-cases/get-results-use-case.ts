import { injectable, inject } from "tsyringe";
import type { ResultDto } from "../dtos/result-dto";
import { ResultService } from "../../domains/services/result-service";
import { IFormRepositoryToken } from "../../domains/repositories/i-form-repository";
import type { IFormRepository } from "../../domains/repositories/i-form-repository";
import type { SheetRow } from "../../../server/quiz-api-contract";

@injectable()
export class GetResultsUseCase {
  constructor(
    @inject(IFormRepositoryToken) private formRepository: IFormRepository,
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
