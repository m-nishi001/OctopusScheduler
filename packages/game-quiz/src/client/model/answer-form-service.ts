import { injectable } from "tsyringe";
import { FormRepository } from "./form-repository";

@injectable()
export class AnswerFormService {
  constructor(private readonly formRepository: FormRepository) {}

  async stopForm(quizId: string): Promise<void> {
    await this.formRepository.stopForm(quizId);
  }
}
