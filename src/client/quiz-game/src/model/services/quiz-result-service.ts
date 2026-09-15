import { injectable } from "tsyringe";
import { GasFunctionService } from "@common-lib/google-apps-script/gas-script-service";

@injectable()
export class QuizResultService {
  async getMappedResponses(formId: string): Promise<any[]> {
    const svc = new GasFunctionService("quizGame_getMappedResponses");
    // pass named arg object as GAS expects
    return await svc.call<any[]>({ formId });
  }

  async loadEmailNameMap(): Promise<void> {
    const svc = new GasFunctionService("quizGame_loadEmailNameMap");
    // call without args; GasFunctionService.call accepts an optional object
    await svc.call({});
  }
}
