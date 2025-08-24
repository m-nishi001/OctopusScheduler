import { DataAccessService } from "../google-spreadsheet-servie";

/**
 * テスト用のスプレッドシートID。
 * このIDは、テスト対象のSpreadsheetInfoクラスが利用するため、
 * スクリプトプロパティに設定しておく必要があります。
 *
 * @see https://script.google.com/home/projects/1VfAM-yry5Uj8GMyNL2U_XQ3loPGJVuF5X_ktYyu78ac
 */
const SPREADSHEET_ID = "1VfAM-yry5Uj8GMyNL2U_XQ3loPGJVuF5X_ktYyu78ac";
const SPREADSHEET_TEST_SHEET_NAME = "TestSheet_" + new Date().getTime();

/**
 * DataAccessService.getRepository() のテスト
 */
function testGetRepository() {
    Logger.log("--- Start: testGetRepository ---");

    // Test Case 1: 有効なシート名を指定してリポジトリが作成できること
    try {
        const repository = DataAccessService.getRepository<{ id: string }>(SPREADSHEET_TEST_SHEET_NAME);
        if (repository) {
            Logger.log("Test Case 1 Passed: 有効なシート名でリポジトリが正常に作成されました。");
        } else {
            Logger.log("Test Case 1 Failed: リポジトリの作成に失敗しました。");
        }
    } catch (e: any) {
        Logger.log(`Test Case 1 Failed: 予期しないエラーが発生しました: ${e.message}`);
    } finally {
        const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SPREADSHEET_TEST_SHEET_NAME);
        if (sheet) {
            SpreadsheetApp.openById(SPREADSHEET_ID).deleteSheet(sheet);
        }
    }

    // Test Case 2: 無効なシート名（空文字列）を指定してエラーがスローされること
    try {
        DataAccessService.getRepository<{ id: string }>("");
        Logger.log("Test Case 2 Failed: 空のシート名でエラーが期待されましたが、スローされませんでした。");
    } catch (e: any) {
        if (e.message === "Invalid sheet name provided.") {
            Logger.log("Test Case 2 Passed: 空のシート名で正しいエラーがスローされました。");
        } else {
            Logger.log(`Test Case 2 Failed: 予期しないエラーがスローされました: ${e.message}`);
        }
    }

    // Test Case 3: 無効なシート名（null）を指定してエラーがスローされること
    try {
        DataAccessService.getRepository<{ id: string }>(null as any);
        Logger.log("Test Case 3 Failed: nullのシート名でエラーが期待されましたが、スローされませんでした。");
    } catch (e: any) {
        if (e.message === "Invalid sheet name provided.") {
            Logger.log("Test Case 3 Passed: nullのシート名で正しいエラーがスローされました。");
        } else {
            Logger.log(`Test Case 3 Failed: 予期しないエラーがスローされました: ${e.message}`);
        }
    }
    Logger.log("--- End: testGetRepository ---");
}

/**
 * DataAccessServiceで取得したIRepositoryのメソッドをテスト
 */
function testRepositoryMethods() {
    Logger.log("--- Start: testRepositoryMethods ---");
    const repository = DataAccessService.getRepository<{ id?: string, name: string, email: string }>(SPREADSHEET_TEST_SHEET_NAME);

    // cleanup before test
    try {
        repository.delete(() => true);
    } catch (e) {
        // ignore
    }

    // Test Case 1: 新しいエンティティの保存
    try {
        const newEntity = { name: "Test User 1", email: "user1@example.com" };
        const savedEntity = repository.save(newEntity);
        if (savedEntity) {
            Logger.log(`Test Case 1 Passed: 新規エンティティが正常に保存されました。ID: ${savedEntity.id}`);
        } else {
            Logger.log("Test Case 1 Failed: 新規エンティティの保存に失敗しました。");
        }
    } catch (e: any) {
        Logger.log(`Test Case 1 Failed: 予期しないエラーが発生しました: ${e.message}`);
    }

    // Test Case 2: 既存エンティティの更新
    try {
        const existingEntity = repository.findOne(e => e.name === "Test User 1");
        if (existingEntity) {
            const updatedEntity = { ...existingEntity, email: "user1_updated@example.com" };
            const savedEntity = repository.save(updatedEntity);
            if (savedEntity.email === "user1_updated@example.com") {
                Logger.log("Test Case 2 Passed: 既存エンティティが正常に更新されました。");
            } else {
                Logger.log("Test Case 2 Failed: 既存エンティティの更新に失敗しました。");
            }
        } else {
            Logger.log("Test Case 2 Skipped: 既存エンティティが見つからず、テストできませんでした。");
        }
    } catch (e: any) {
        Logger.log(`Test Case 2 Failed: 予期しないエラーが発生しました: ${e.message}`);
    }

    // Test Case 3: 条件に一致するエンティティの検索 (find)
    try {
        const foundEntities = repository.find(e => e.name.startsWith("Test"));
        if (foundEntities.length > 0) {
            Logger.log(`Test Case 3 Passed: ${foundEntities.length}件のエンティティが見つかりました。`);
        } else {
            Logger.log("Test Case 3 Failed: エンティティが見つかりませんでした。");
        }
    } catch (e: any) {
        Logger.log(`Test Case 3 Failed: 予期しないエラーが発生しました: ${e.message}`);
    }

    // Test Case 4: 条件に一致する最初のエンティティの検索 (findOne)
    try {
        const foundEntity = repository.findOne(e => e.email === "user1_updated@example.com");
        if (foundEntity) {
            Logger.log("Test Case 4 Passed: 最初のエンティティが正常に見つかりました。");
        } else {
            Logger.log("Test Case 4 Failed: 最初のエンティティが見つかりませんでした。");
        }
    } catch (e: any) {
        Logger.log(`Test Case 4 Failed: 予期しないエラーが発生しました: ${e.message}`);
    }

    // Test Case 5: エンティティの削除 (delete)
    try {
        const isDeleted = repository.delete(e => e.name === "Test User 1");
        if (isDeleted) {
            Logger.log("Test Case 5 Passed: エンティティが正常に削除されました。");
        } else {
            Logger.log("Test Case 5 Failed: エンティティの削除に失敗しました。");
        }
    } catch (e: any) {
        Logger.log(`Test Case 5 Failed: 予期しないエラーが発生しました: ${e.message}`);
    }

    // cleanup after test
    try {
        const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SPREADSHEET_TEST_SHEET_NAME);
        if (sheet) {
            SpreadsheetApp.openById(SPREADSHEET_ID).deleteSheet(sheet);
        }
    } catch (e) {
        Logger.log(`Cleanup failed: ${e}`);
    }

    Logger.log("--- End: testRepositoryMethods ---");
}