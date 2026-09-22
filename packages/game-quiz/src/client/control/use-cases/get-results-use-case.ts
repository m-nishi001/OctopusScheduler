import { injectable, inject } from "tsyringe";
import type { ResultDto } from "../dto/result-dto";
import { ResultService } from "../../model/result-service";
import { FormRepository } from "../../model/form-repository";
import type { SheetRow } from "../../../server/quiz-api-contract";

@injectable()
export class GetResultsUseCase {
  constructor(
    @inject(FormRepository) private readonly formRepository: FormRepository,
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
