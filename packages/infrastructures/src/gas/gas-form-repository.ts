import { injectable } from "tsyringe";
import type { IFormRepository } from "../interfaces/form-repository";

@injectable()
export class GasFormRepository implements IFormRepository {
  stopAcceptingResponses(formId: string): void {
    const form = FormApp.openById(formId);
    form.setAcceptingResponses(false);
  }

  getDestinationRecordStoreId(formId: string): string | null {
    const form = FormApp.openById(formId);
    const destinationType = form.getDestinationType();
    if (destinationType === FormApp.DestinationType.SPREADSHEET) {
      return form.getDestinationId();
    }
    return null;
  }
}
