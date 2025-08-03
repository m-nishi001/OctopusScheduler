export class SpreadsheetName {
    name: string;
    private constructor(name: string) {
        this.name = name;
    }

    static creaate(name: string): SpreadsheetName | null {
        if (name === "") {
            Logger.log(`[SheetName.create] sheetName is empty.`);
            return null;
        }

        return new SpreadsheetName(name);
    }
}