import { injectable, inject } from "tsyringe";
import { FormRepository } from "../repositories/form-repository";

@injectable()
export class AnswerFormService {
  constructor(@inject(FormRepository) private formRepository: FormRepository) {}

  async stopForm(quizId: string): Promise<void> {
    await this.formRepository.stopForm(quizId);
  }
}
