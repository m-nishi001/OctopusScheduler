import type { IFormRepository } from "@octopus/infrastructures/interfaces";

export function stopForm(deps: { form: IFormRepository }, quizId: string): void {
  deps.form.stopAcceptingResponses(quizId);
}
