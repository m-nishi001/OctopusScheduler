export class SpreadsheetId {
    id: string;
    private constructor(id: string) {
        this.id = id;
    }

    static create(id: string): SpreadsheetId | null {
        if (id === "") {
            Logger.log(`[SpreadsheetId.create] id is empty.`);
            return null;
        }
        return new SpreadsheetId(id);
    }
}