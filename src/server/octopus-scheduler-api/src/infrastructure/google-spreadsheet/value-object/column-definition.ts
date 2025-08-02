export class ColumnDefinition {
    colmunName: string;
    isKey: boolean;
    private constructor(colmunName: string, isKey: boolean = false) {
        this.colmunName = colmunName;
        this.isKey = isKey;
    }

    static create(columnName: string, isKey: boolean = false): ColumnDefinition | null {
        if (columnName === "") {
            Logger.log(`[ColumnDefinition.create] colmunName is empty.`);
            return null;
        }

        return new ColumnDefinition(columnName, isKey);
    }
}