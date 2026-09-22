import { injectable, inject } from "tsyringe";
import type { ResultDto } from "../dto/result-dto";
import { ResultService } from "../../model/result-service";
import { FormRepository } from "../../model/form-repository";
import type { SheetRow, ProcessedResultDto } from "../../../server/quiz-api-contract";

@injectable()
export class StopQuizUseCase {
  constructor(
    @inject(FormRepository) private readonly formRepository: FormRepository,
    @inject(ResultService) private resultService: ResultService
  ) {}

  async execute(
    quizId: string,
    quizStartTimeMs?: number,
    answerKey?: string,
    correctValue?: string
  ): Promise<ResultDto[] | ProcessedResultDto[]> {
    if (quizStartTimeMs !== undefined && answerKey && correctValue) {
      // New path: stop and get processed results
      return await this.formRepository.stopAndGetProcessedResults(
        quizId,
        quizStartTimeMs,
        answerKey,
        correctValue
      );
    } else {
      // Legacy path
      await this.formRepository.stopForm(quizId);
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
}
