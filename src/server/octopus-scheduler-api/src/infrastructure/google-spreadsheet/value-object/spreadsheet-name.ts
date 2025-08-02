export class SpreadSheetName {
    name: string;
    private constructor(sheetName: string) {
        this.name = sheetName;
    }

    static creaate(sheetName: string): SpreadSheetName | null {
        if (sheetName === "") {
            Logger.log(`[SheetName.create] sheetName is empty.`);
            return null;
        }

        return new SpreadSheetName(sheetName);
    }
}