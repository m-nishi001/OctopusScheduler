export class GoogleFormService {
    stopForm(formId) {
        const form = FormApp.openById(formId);
        form.setAcceptingResponses(false);
    }
    getDestinationSpreadsheetId(formId) {
        const form = FormApp.openById(formId);
        const destinationType = form.getDestinationType();
        if (destinationType === FormApp.DestinationType.SPREADSHEET) {
            return form.getDestinationId();
        }
        return null;
    }
}
