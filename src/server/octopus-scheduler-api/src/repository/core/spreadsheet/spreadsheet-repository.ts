/**
 * スプレッドシートを永続化先とする汎用リポジトリの実装。
 * IRepository<T, K> インターフェースを実装し、スプレッドシートへの直接的なI/O操作を行います。
 * スプレッドシートに関する全てのユーティリティ関数もこのクラス内に集約されています。
 * @template T ドメインオブジェクトの型
 * @template K キーの型
 */
export class SpreadsheetRepository<T, K> implements IRepository<T, K> {
    protected spreadsheetId: string;
    protected sheetName: string;
    protected mapper: IEntityRowMapper<T>;
    protected keyColumnIndex: number;

    private readonly HEADER_ROW_COUNT = 1;
    protected readonly LOCK_WAIT_TIME_SECONDS = 30;

    /**
     * SpreadsheetRepository の新しいインスタンスを初期化します。
     * @param spreadsheetId 操作対象のスプレッドシートID
     * @param sheetName デフォルトのシート名
     * @param mapper ドメインオブジェクトとシート行の変換ロジック
     * @param keyColumnIndex データを識別するためのキーが格納されている列のインデックス（0始まり、デフォルトは0）
     */
    constructor(
        spreadsheetId: string,
        sheetName: string,
        mapper: IEntityRowMapper<T>,
        keyColumnIndex: number = 0
    ) {
        this.spreadsheetId = spreadsheetId;
        this.sheetName = sheetName;
        this.mapper = mapper;
        this.keyColumnIndex = keyColumnIndex;

        this.ensureSheetExists(this.sheetName);
    }

    /**
     * 列番号（1始まり）をアルファベットに変換するヘルパー関数。
     * @param colIndex 列番号 (1始まり)
     * @returns 列のアルファベット表記
     */
    private getColumnLetter(colIndex: number): string {
        let temp, letter = '';
        while (colIndex > 0) {
            temp = (colIndex - 1) % 26;
            letter = String.fromCharCode(temp + 65) + letter;
            colIndex = (colIndex - temp - 1) / 26;
        }
        return letter;
    }

    /**
     * Sheets.Spreadsheets.Values サービスを安全に取得するヘルパー関数。
     * @returns Sheets.Spreadsheets.Values オブジェクト
     * @throws Error スプレッドシートサービスが利用できない場合
     */
    private getSheetsValuesService(): GoogleAppsScript.Sheets.Collection.Spreadsheets.ValuesCollection {
        if (typeof Sheets === 'undefined' || typeof Sheets.Spreadsheets === 'undefined' || typeof Sheets.Spreadsheets.Values === 'undefined') {
            throw new Error("Google Sheets API service (Sheets.Spreadsheets.Values) is not available. Please ensure the 'Google Sheets API' service is enabled in your Apps Script project.");
        }
        return Sheets.Spreadsheets.Values;
    }

    /**
     * Sheets.Spreadsheets サービスを安全に取得するヘルパー関数。
     * batchUpdateRequests で行の削除などをする際に必要。
     * @returns Sheets.Spreadsheets オブジェクト
     * @throws Error スプレッドシートサービスが利用できない場合
     */
    private getSheetsService(): GoogleAppsScript.Sheets.Collection.SpreadsheetsCollection {
        if (typeof Sheets === 'undefined' || typeof Sheets.Spreadsheets === 'undefined') {
            throw new Error("Google Sheets API service (Sheets.Spreadsheets) is not available. Please ensure the 'Google Sheets API' service is enabled in your Apps Script project.");
        }
        return Sheets.Spreadsheets;
    }

    /**
     * unknown 型の値を Sheets API の ExtendedValue 型に変換します。
     * @param value 変換する値
     * @returns ExtendedValue オブジェクト
     */
    private convertToExtendedValue(value: unknown): GoogleAppsScript.Sheets.Schema.ExtendedValue {
        if (typeof value === 'string') {
            return { stringValue: value };
        }
        if (typeof value === 'number') {
            return { numberValue: value };
        }
        if (typeof value === 'boolean') {
            return { boolValue: value };
        }
        if (value instanceof Date) {
            return { stringValue: value.toISOString() };
        }
        return { stringValue: String(value) };
    }

    /**
     * 指定されたシートが存在することを確認し、存在しない場合は新しくシートを作成します。
     * @param sheetName 確認または作成するシート名
     * @throws Error シートの作成に失敗した場合
     */
    private ensureSheetExists(sheetName: string): void {
        const lock = LockService.getScriptLock();
        const lockAcquired = lock.tryLock(this.LOCK_WAIT_TIME_SECONDS * 1000);

        if (!lockAcquired) {
            Logger.log(`Could not acquire lock to ensure sheet ${sheetName} exists within ${this.LOCK_WAIT_TIME_SECONDS} seconds.`);
            throw new Error(`Failed to acquire lock for ensuring sheet ${sheetName} exists.`);
        }

        try {
            const sheetsService = this.getSheetsService();
            const spreadsheet = sheetsService.get(this.spreadsheetId);
            const sheet = spreadsheet.sheets?.find(s => s.properties?.title === sheetName);

            if (!sheet) {
                Logger.log(`Sheet "${sheetName}" not found. Creating new sheet.`);
                const requests = [{
                    addSheet: {
                        properties: {
                            title: sheetName
                        }
                    }
                }];
                sheetsService.batchUpdate({ requests: requests }, this.spreadsheetId);
                Logger.log(`Sheet "${sheetName}" created successfully.`);
            } else {
                Logger.log(`Sheet "${sheetName}" already exists.`);
            }
        } catch (e) {
            Logger.log(`Error ensuring sheet ${sheetName} exists: ${e instanceof Error ? e.message : String(e)}`);
            throw new Error(`Failed to ensure sheet ${sheetName} exists: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            lock.releaseLock();
            Logger.log(`Lock released for ensuring sheet ${sheetName} exists.`);
        }
    }

    /**
     * シートから全データを読み込みます。
     * @returns シートの全データ（二次元配列）
     * @throws Error シートデータの読み込みに失敗した場合
     */
    protected readAllSheetDataInternal(): unknown[][] {
        Logger.log(`Reading from spreadsheet via Sheets API for ${this.sheetName}.`);
        try {
            const sheetsValues = this.getSheetsValuesService();
            const range = `${this.sheetName}!A:ZZ`;
            const response = sheetsValues.get(this.spreadsheetId, range);
            return response.values || [];
        } catch (e) {
            Logger.log(`Error reading sheet ${this.sheetName}: ${e instanceof Error ? e.message : String(e)}`);
            throw new Error(`Failed to read sheet data: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    /**
     * シート全体を上書きします。排他制御（Document Lock）を行います。
     * 主に初期化や大規模なデータ変更時に使用します。
     * @param data 書き込むデータ（二次元配列）
     * @throws Error ロックの取得に失敗した場合、またはシートデータの書き込みに失敗した場合
     */
    protected writeAllSheetDataInternal(data: unknown[][]): void {
        const lock = LockService.getScriptLock();
        const lockAcquired = lock.tryLock(this.LOCK_WAIT_TIME_SECONDS * 1000);

        if (!lockAcquired) {
            Logger.log(`Could not acquire lock for sheet ${this.sheetName} within ${this.LOCK_WAIT_TIME_SECONDS} seconds.`);
            throw new Error(`Failed to acquire lock for writing data to sheet ${this.sheetName}.`);
        }

        try {
            const sheetsValues = this.getSheetsValuesService();
            const numRows = data.length > 0 ? data.length : 1;
            const numCols = data.length > 0 && data[0].length > 0 ? data[0].length : 1;
            const range = `${this.sheetName}!A1:${this.getColumnLetter(numCols)}${numRows}`;

            const resource = { values: data };

            sheetsValues.update(resource, this.spreadsheetId, range, {
                valueInputOption: 'RAW'
            });
            Logger.log(`Written to spreadsheet for ${this.sheetName}.`);
        } catch (e) {
            Logger.log(`Error writing sheet ${this.sheetName}: ${e instanceof Error ? e.message : String(e)}`);
            throw new Error(`Failed to write sheet data: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            lock.releaseLock();
            Logger.log(`Lock released for sheet ${this.sheetName}.`);
        }
    }

    /**
     * シートに行を追加します。排他制御（Document Lock）を行います。
     * @param data 追加するデータ（二次元配列）
     * @throws Error ロックの取得に失敗した場合、またはシートへの行追加に失敗した場合
     */
    protected appendRowsInternal(data: unknown[][]): void {
        const lock = LockService.getScriptLock();
        const lockAcquired = lock.tryLock(this.LOCK_WAIT_TIME_SECONDS * 1000);

        if (!lockAcquired) {
            Logger.log(`Could not acquire lock for sheet ${this.sheetName} within ${this.LOCK_WAIT_TIME_SECONDS} seconds.`);
            throw new Error(`Failed to acquire lock for appending data to sheet ${this.sheetName}.`);
        }

        try {
            const sheetsValues = this.getSheetsValuesService();
            const range = `${this.sheetName}!A1`;
            const resource = { values: data };

            sheetsValues.append(resource, this.spreadsheetId, range, {
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS'
            });
            Logger.log(`Data appended to spreadsheet for ${this.sheetName}.`);
        } catch (e) {
            Logger.log(`Error appending data to sheet ${this.sheetName}: ${e instanceof Error ? e.message : String(e)}`);
            throw new Error(`Failed to append data to sheet: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            lock.releaseLock();
            Logger.log(`Lock released for sheet ${this.sheetName}.`);
        }
    }

    /**
     * シートの特定の範囲を更新します。排他制御（Document Lock）を行います。
     * @param data 更新するデータ
     * @param startRow 更新を開始する行番号（1始まり）
     * @param startCol 更新を開始する列番号（1始まり）
     * @throws Error ロックの取得に失敗した場合、またはシートの部分更新に失敗した場合
     */
    protected updateRangeDataInternal(data: unknown[][], startRow: number, startCol: number): void {
        const lock = LockService.getScriptLock();
        const lockAcquired = lock.tryLock(this.LOCK_WAIT_TIME_SECONDS * 1000);

        if (!lockAcquired) {
            Logger.log(`Could not acquire lock for sheet ${this.sheetName} within ${this.LOCK_WAIT_TIME_SECONDS} seconds.`);
            throw new Error(`Failed to acquire lock for updating partial data on sheet ${this.sheetName}.`);
        }

        try {
            const sheetsValues = this.getSheetsValuesService();
            const numRows = data.length;
            const numCols = data.length > 0 ? data[0].length : 0;
            if (numRows === 0 || numCols === 0) {
                Logger.log("No data to update for partial update.");
                return;
            }
            const range = `${this.sheetName}!${this.getColumnLetter(startCol)}${startRow}:${this.getColumnLetter(startCol + numCols - 1)}${startRow + numRows - 1}`;

            const resource = { values: data };
            sheetsValues.update(resource, this.spreadsheetId, range, { valueInputOption: 'RAW' });
            Logger.log(`Partial data updated on spreadsheet for ${this.sheetName}.`);
        } catch (e) {
            Logger.log(`Error updating partial sheet ${this.sheetName}: ${e instanceof Error ? e.message : String(e)}`);
            throw new Error(`Failed to update partial sheet data: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            lock.releaseLock();
            Logger.log(`Lock released for sheet ${this.sheetName}.`);
        }
    }

    /**
     * シートから特定の行を削除します。排他制御（Document Lock）を行います。
     * @param startRow 削除を開始する行番号（1始まり）
     * @param numRows 削除する行数
     * @throws Error ロックの取得に失敗した場合、またはシートからの行削除に失敗した場合
     */
    protected deleteRowsInternal(startRow: number, numRows: number): void {
        const lock = LockService.getScriptLock();
        const lockAcquired = lock.tryLock(this.LOCK_WAIT_TIME_SECONDS * 1000);

        if (!lockAcquired) {
            Logger.log(`Could not acquire lock for sheet ${this.sheetName} within ${this.LOCK_WAIT_TIME_SECONDS} seconds.`);
            throw new Error(`Failed to acquire lock for deleting rows from sheet ${this.sheetName}.`);
        }

        try {
            if (numRows <= 0) {
                Logger.log("No rows to delete.");
                return;
            }
            const sheetsService = this.getSheetsService();
            const spreadsheet = sheetsService.get(this.spreadsheetId);
            const sheet = spreadsheet.sheets?.find(s => s.properties?.title === this.sheetName);

            if (!sheet || !sheet.properties?.sheetId) {
                throw new Error(`Sheet with name "${this.sheetName}" not found or has no ID.`);
            }

            const requests = [{
                deleteDimension: {
                    range: {
                        sheetId: sheet.properties.sheetId,
                        dimension: 'ROWS',
                        startIndex: startRow - 1,
                        endIndex: startRow - 1 + numRows
                    }
                }
            }];

            sheetsService.batchUpdate({ requests: requests }, this.spreadsheetId);
            Logger.log(`Rows deleted from spreadsheet for ${this.sheetName}.`);
        } catch (e) {
            Logger.log(`Error deleting rows from sheet ${this.sheetName}: ${e instanceof Error ? e.message : String(e)}`);
            throw new Error(`Failed to delete rows from sheet: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            lock.releaseLock();
            Logger.log(`Lock released for sheet ${this.sheetName}.`);
        }
    }

    /**
     * 複数の操作を単一のバッチリクエストとして実行します。排他制御（Document Lock）を行います。
     * @param requests 実行するバッチリクエストの配列
     * @throws Error ロックの取得に失敗した場合、またはバッチ更新に失敗した場合
     */
    protected batchUpdateRequestsInternal(requests: GoogleAppsScript.Sheets.Schema.Request[]): void {
        const lock = LockService.getScriptLock();
        const lockAcquired = lock.tryLock(this.LOCK_WAIT_TIME_SECONDS * 1000);

        if (!lockAcquired) {
            Logger.log(`Could not acquire lock for sheet ${this.sheetName} within ${this.LOCK_WAIT_TIME_SECONDS} seconds.`);
            throw new Error(`Failed to acquire lock for batch updating sheet ${this.sheetName}.`);
        }

        try {
            if (requests.length === 0) {
                Logger.log("No batch requests to execute.");
                return;
            }
            const sheetsService = this.getSheetsService();
            sheetsService.batchUpdate({ requests: requests }, this.spreadsheetId);
            Logger.log(`Batch update requests executed for ${this.sheetName}.`);
        } catch (e) {
            Logger.log(`Error executing batch update for sheet ${this.sheetName}: ${e instanceof Error ? e.message : String(e)}`);
            throw new Error(`Failed to execute batch update requests: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            lock.releaseLock();
            Logger.log(`Lock released for sheet ${this.sheetName}.`);
        }
    }

    /**
     * データを新規作成します（単発）。
     * @param item 作成するデータオブジェクト
     * @returns 作成されたデータオブジェクト
     */
    create(item: T): T {
        const rowsToAppend = [this.mapper.entityToRow(item)];
        this.handleInitialAppend(rowsToAppend);
        return item;
    }

    /**
     * データを新規作成します（バッチ）。
     * @param items 作成するデータオブジェクトの配列
     * @returns 作成されたデータオブジェクトの配列
     */
    createBatch(items: T[]): T[] {
        if (items.length === 0) {
            return [];
        }
        const rowsToAppend = items.map(item => this.mapper.entityToRow(item));
        this.handleInitialAppend(rowsToAppend);
        return items;
    }

    /**
     * 初回レコード追加時にヘッダー行を考慮してデータを追加します。
     * シートが空の場合、ヘッダー行とデータ行を一括で追加します。
     * @param dataRows 追加するデータ行の配列
     */
    protected handleInitialAppend(dataRows: unknown[][]): void {
        const currentData = this.readAllSheetDataInternal();
        // シートが完全に空の場合 (ヘッダー行もない場合)
        if (currentData.length === 0 || (currentData.length === 1 && currentData[0].every(cell => !cell))) {
            const headerRow = this.mapper.getHeader();
            if (!headerRow || headerRow.length === 0) {
                Logger.log("Warning: Header row not provided by mapper, but sheet is empty. Proceeding without header.");
                // ヘッダーが定義されていない場合はデータ行のみ追加
                this.appendRowsInternal(dataRows);
            } else {
                Logger.log("Sheet is empty. Appending header row and initial data.");
                // ヘッダー行とデータ行を結合して一括追加
                this.appendRowsInternal([headerRow, ...dataRows]);
            }
        } else {
            // シートに既存のデータ (またはヘッダー行) がある場合
            Logger.log("Sheet has existing data. Appending data rows only.");
            this.appendRowsInternal(dataRows);
        }
    }

    /**
     * データを読み込みます（単発）。
     * @param key データを識別するキー
     * @returns 読み込まれたデータオブジェクト、またはnull
     */
    read(key: K): T | null {
        Logger.log(`Attempting to read key: ${String(key)} from sheet ${this.sheetName}.`); // デバッグログ追加
        const allData = this.readAllSheetDataInternal();
        Logger.log(`Full data read from sheet: ${JSON.stringify(allData)}`); // デバッグログ追加
        // ヘッダー行を正しくスキップ
        const dataRows = allData.slice(this.HEADER_ROW_COUNT);

        const foundRow = dataRows.find(row => String(row[this.keyColumnIndex]) === String(key));

        if (foundRow) { // デバッグログ追加
            Logger.log(`Found row for key ${String(key)}: ${JSON.stringify(foundRow)}`);
            return this.mapper.rowToEntity(foundRow);
        } else { // デバッグログ追加
            Logger.log(`No row found for key ${String(key)}.`);
            return null;
        }
    }

    /**
     * 全てのデータを読み込みます。
     * @returns 全てのデータオブジェクトの配列
     */
    readAll(): T[] {
        const allData = this.readAllSheetDataInternal();
        // ヘッダー行を正しくスキップ
        const dataRows = allData.slice(this.HEADER_ROW_COUNT);

        return dataRows.map(row => this.mapper.rowToEntity(row));
    }

    /**
     * データを更新します（単発）。
     * @param key データを識別するキー
     * @param updates 更新するデータオブジェクト（部分更新可）
     * @returns 更新されたデータオブジェクト、またはnull
     */
    update(key: K, updates: Partial<T>): T | null {
        const allData = this.readAllSheetDataInternal();
        const dataRows = allData.slice(this.HEADER_ROW_COUNT);

        const foundIndex = dataRows.findIndex(row => String(row[this.keyColumnIndex]) === String(key));

        if (foundIndex !== -1) {
            const targetRow = dataRows[foundIndex];
            const currentItem = this.mapper.rowToEntity(targetRow);
            const updatedItem = { ...currentItem, ...updates };
            const updatedRowData = this.mapper.entityToRow(updatedItem);

            const sheetsApiRowIndex = this.HEADER_ROW_COUNT + foundIndex + 1;
            this.updateRangeDataInternal([updatedRowData], sheetsApiRowIndex, 1);

            return updatedItem;
        }
        return null;
    }

    /**
     * データを更新します（バッチ）。
     * @param updatesMap キーと更新内容のマップ
     * @returns 更新されたデータオブジェクトの配列
     */
    updateBatch(updatesMap: Map<K, Partial<T>>): (T | null)[] {
        if (updatesMap.size === 0) {
            return [];
        }

        const allData = this.readAllSheetDataInternal();
        const dataRows = allData.slice(this.HEADER_ROW_COUNT);

        const sheetsService = this.getSheetsService();
        const spreadsheet = sheetsService.get(this.spreadsheetId);
        const sheet = spreadsheet.sheets?.find(s => s.properties?.title === this.sheetName);
        if (!sheet || !sheet.properties?.sheetId) {
            throw new Error(`Sheet with name "${this.sheetName}" not found or has no ID for batch update.`);
        }
        const sheetId = sheet.properties.sheetId;

        const requests: GoogleAppsScript.Sheets.Schema.Request[] = [];
        const updatedItems: (T | null)[] = [];

        dataRows.forEach((row, index) => {
            const key = row[this.keyColumnIndex] as K;
            if (updatesMap.has(key)) {
                const currentItem = this.mapper.rowToEntity(row);
                const updates = updatesMap.get(key)!;
                const updatedItem = { ...currentItem, ...updates };
                const updatedRowData = this.mapper.entityToRow(updatedItem);

                const sheetsApiRowIndex = this.HEADER_ROW_COUNT + index + 1;

                requests.push({
                    updateCells: {
                        rows: [{ values: updatedRowData.map(val => ({ userEnteredValue: this.convertToExtendedValue(val) })) }],
                        range: {
                            sheetId: sheetId,
                            startRowIndex: sheetsApiRowIndex - 1,
                            endRowIndex: sheetsApiRowIndex,
                            startColumnIndex: 0,
                            endColumnIndex: updatedRowData.length,
                        },
                        fields: '*'
                    }
                });
                updatedItems.push(updatedItem);
                updatesMap.delete(key);
            }
        });

        if (requests.length > 0) {
            this.batchUpdateRequestsInternal(requests);
        }

        updatesMap.forEach(() => updatedItems.push(null));
        return updatedItems;
    }

    /**
     * データを削除します（単発）。
     * @param key データを識別するキー
     * @returns 削除が成功したかどうかの真偽値
     */
    delete(key: K): boolean {
        const allData = this.readAllSheetDataInternal();
        const dataRows = allData.slice(this.HEADER_ROW_COUNT);

        const foundIndex = dataRows.findIndex(row => String(row[this.keyColumnIndex]) === String(key));

        if (foundIndex !== -1) {
            const sheetsApiRowIndex = this.HEADER_ROW_COUNT + foundIndex + 1;
            this.deleteRowsInternal(sheetsApiRowIndex, 1);
            return true;
        }
        return false;
    }

    /**
     * データを削除します（バッチ）。
     * @param keys 削除するキーの配列
     * @returns 削除が成功したかどうかの真偽値
     */
    deleteBatch(keys: K[]): boolean {
        if (keys.length === 0) {
            return false;
        }

        const allData = this.readAllSheetDataInternal();
        const dataRows = allData.slice(this.HEADER_ROW_COUNT);

        const sheetsService = this.getSheetsService();
        const spreadsheet = sheetsService.get(this.spreadsheetId);
        const sheet = spreadsheet.sheets?.find(s => s.properties?.title === this.sheetName);
        if (!sheet || !sheet.properties?.sheetId) {
            throw new Error(`Sheet with name "${this.sheetName}" not found or has no ID for batch delete.`);
        }
        const sheetId = sheet.properties.sheetId;

        const rowsToDeleteIndices: number[] = [];
        keys.forEach(key => {
            const foundIndex = dataRows.findIndex(row => String(row[this.keyColumnIndex]) === String(key));
            if (foundIndex !== -1) {
                rowsToDeleteIndices.push(this.HEADER_ROW_COUNT + foundIndex + 1);
            }
        });

        if (rowsToDeleteIndices.length === 0) {
            return false;
        }

        // 削除は逆順に行うことで、インデックスのずれを防ぐ
        rowsToDeleteIndices.sort((a, b) => b - a);

        const requests: GoogleAppsScript.Sheets.Schema.Request[] = [];
        rowsToDeleteIndices.forEach(rowIndex => {
            requests.push({
                deleteDimension: {
                    range: {
                        sheetId: sheetId,
                        dimension: 'ROWS',
                        startIndex: rowIndex - 1,
                        endIndex: rowIndex
                    }
                }
            });
        });

        if (requests.length > 0) {
            this.batchUpdateRequestsInternal(requests);
            return true;
        }
        return false;
    }


    /**
     * ヘッダー行を取得します。
     * @returns ヘッダー行のデータ
     */
    protected getHeader(): string[] {
        const header = this.mapper.getHeader();
        if (!header) {
            Logger.log("Warning: IEntityRowMapper.getHeader() did not return a header. This may cause issues if the sheet requires explicit headers.");
            return [];
        }
        return header;
    }

    /**
     * シート名からシートIDを取得するヘルパー関数。
     * @param sheetName 対象シート名
     * @returns シートID、またはnull
     */
    protected getSheetId(sheetName: string): number | null {
        try {
            const sheetsService = this.getSheetsService();
            const spreadsheet = sheetsService.get(this.spreadsheetId);
            const sheet = spreadsheet.sheets?.find(s => s.properties?.title === sheetName);
            return sheet?.properties?.sheetId || null;
        } catch (e) {
            Logger.log(`Error getting sheet ID for ${sheetName}: ${e instanceof Error ? e.message : String(e)}`);
            throw new Error(`Failed to get sheet ID for batch operations: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
}