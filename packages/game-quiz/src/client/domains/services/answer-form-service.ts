import { injectable, inject } from "tsyringe";
import { IFormRepositoryToken } from "../repositories/i-form-repository";
import type { IFormRepository } from "../repositories/i-form-repository";

@injectable()
export class AnswerFormService {
  constructor(
    @inject(IFormRepositoryToken) private formRepository: IFormRepository
  ) {}

  async stopForm(quizId: string): Promise<void> {
    await this.formRepository.stopForm(quizId);
  }
}
