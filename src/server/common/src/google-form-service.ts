export class GoogleFormService {
  stopForm(formId: string): void {
    const form = FormApp.openById(formId);
    form.setAcceptingResponses(false);
  }

  getDestinationSpreadsheetId(formId: string): string | null {
    const form = FormApp.openById(formId);
    const destinationType = form.getDestinationType();
    if (destinationType === FormApp.DestinationType.SPREADSHEET) {
      return form.getDestinationId();
    }
    return null;
  }
}
