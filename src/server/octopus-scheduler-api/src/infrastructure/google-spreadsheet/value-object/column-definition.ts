export class ColumnDefinition {

    colmunName: string;

    private constructor(colmunName: string) {
        this.colmunName = colmunName;
    }

    static create(columnName: string): ColumnDefinition | null {
        if (columnName === "") {
            Logger.log(`[ColumnDefinition.create] colmunName is empty.`);
            return null;
        }
        return new ColumnDefinition(columnName);
    }
}