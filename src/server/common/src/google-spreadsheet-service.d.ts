export interface SpreadsheetData {
    sheetName: string;
    data: any[][];
}
export declare class SpreadsheetService {
    private spreadsheetId;
    constructor(spreadsheetId: string | null);
    upsertSpreadsheetData(spreadsheetData: SpreadsheetData): void;
    getAllSpreadsheetNames(): string[];
    getSpreadsheetData(sheetName: string): SpreadsheetData | null;
    removeSpreadsheetData(sheetName: string): void;
    appendRows(sheetName: string, rows: any[][]): void;
    findRowIndexById(sheetName: string, idColumnIndex?: number): Map<string, number>;
    updateRowsById(sheetName: string, rowsMap: Map<string, any[]>, idColumnIndex?: number): {
        updated: number;
        missingIds: string[];
    };
}
