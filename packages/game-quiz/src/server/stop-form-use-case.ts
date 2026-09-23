export interface StopFormDeps {
  form: { stopAcceptingResponses(formId: string): void };
}

export function stopForm(deps: StopFormDeps, quizId: string): void {
  deps.form.stopAcceptingResponses(quizId);
}
