export class SpreadSheetId {
    id: string;
    private constructor(id: string) {
        this.id = id;
    }

    static create(id: string): SpreadSheetId | null {
        if (id === "") {
            Logger.log(`[SpreadSheetId.create] id is empty.`);
            return null;
        }
        return new SpreadSheetId(id);
    }
}