import { SpreadSheetId, SpreadSheetName, ColumnDefinition, SpreadSheetDto, GooogleSpreadSheetService, SpreadSheetQuery } from "../spread-sheet-servie";

/**
 * テスト用のエンティティクラス。
 * スプレッドシートの各行がこのエンティティに対応します。
 */
export class TestEntity {
    id: string;
    name: string;
    value: number;

    /**
     * TestEntityの新しいインスタンスを生成します。
     * @param id エンティティの一意のID (キーカラム)
     * @param name エンティティの名前
     * @param value エンティティの数値
     */
    constructor(id: string = '', name: string = '', value: number = 0) {
        this.id = id;
        this.name = name;
        this.value = value;
    }
}

/**
 * SpreadSheetServiceの機能を確認するためのテストクラスです。
 * runメソッドにスプレッドシートIDを渡すことで、CRUD操作のデモンストレーションを実行します。
 */
export class SpreadSheetServiceTest {
    /**
     * SpreadSheetServiceのテストを実行します。
     * 指定されたスプレッドシート内に「TestSheet」という名前のシートを作成（またはクリア）し、
     * CRUD操作の一連の流れをログに出力します。
     * @param spreadSheetIdStr テストに使用するGoogleスプレッドシートのID
     */
    static run(spreadSheetIdStr: string) {
        try {
            Logger.log("--- SpreadSheetServiceTest 開始 ---");

            // スプレッドシートIDのバリデーション
            const spreadSheetId = SpreadSheetId.create(spreadSheetIdStr);
            if (!spreadSheetId) {
                Logger.log("エラー: 無効なスプレッドシートIDです。");
                return;
            }

            // テスト用シート名の定義
            const testSheetName = SpreadSheetName.creaate("TestSheet");
            if (!testSheetName) {
                Logger.log("エラー: 無効なテストシート名です。");
                return;
            }

            // カラム定義 (idをキーカラムとする)
            const columns: ColumnDefinition[] = [
                ColumnDefinition.create("id", true)!, // idをキーカラムとして設定
                ColumnDefinition.create("name")!,
                ColumnDefinition.create("value")!
            ];

            // 1. Insert 操作のテスト (一括追加)
            Logger.log("--- Insert 操作のテスト ---");
            const entitiesToInsert: TestEntity[] = [
                new TestEntity("1", "Alice", 100),
                new TestEntity("2", "Bob", 200),
                new TestEntity("3", "Charlie", 300),
            ];
            const insertDto = SpreadSheetDto.create(spreadSheetId, testSheetName, columns, entitiesToInsert);
            if (insertDto) {
                const insertedCount = GooogleSpreadSheetService.insert(insertDto);
                Logger.log(`${insertedCount} 件のレコードを挿入しました。`);
            } else {
                Logger.log("Insert用DTOの作成に失敗しました。");
            }

            // 2. Select 操作のテスト (全件取得)
            Logger.log("--- Select 操作のテスト (全件取得) ---");
            // 全てのエンティティを対象とするクエリ
            const selectQueryAll = new SpreadSheetQuery(
                spreadSheetId,
                testSheetName,
                () => new TestEntity(), // TestEntityのファクトリ関数
                (entity) => true  // 全てのエンティティを選択
            );
            const allEntities = GooogleSpreadSheetService.select(selectQueryAll);
            Logger.log("全てのエンティティ:");
            if (allEntities && allEntities.length > 0) {
                allEntities.forEach(e => Logger.log(JSON.stringify(e)));
            } else {
                Logger.log("エンティティが見つかりませんでした、またはSelectに失敗しました。");
            }

            // 3. Select 操作のテスト (条件指定取得)
            Logger.log("--- Select 操作のテスト (条件指定取得) ---");
            // valueが150より大きいエンティティを対象とするクエリ
            const selectQueryFiltered = new SpreadSheetQuery(
                spreadSheetId,
                testSheetName,
                () => new TestEntity(),
                (entity) =>  entity.value > 150
            );
            const filteredEntities = GooogleSpreadSheetService.select(selectQueryFiltered);
            Logger.log("valueが150より大きいエンティティ:");
            if (filteredEntities && filteredEntities.length > 0) {
                filteredEntities.forEach(e => Logger.log(JSON.stringify(e)));
            } else {
                Logger.log("条件に一致するエンティティが見つかりませんでした、またはSelectに失敗しました。");
            }

            // 4. Update 操作のテスト (一括更新)
            Logger.log("--- Update 操作のテスト ---");
            const entitiesToUpdate: TestEntity[] = [
                new TestEntity("1", "Alice Updated", 150), // Aliceの情報を更新
                new TestEntity("3", "Charlie Updated", 350), // Charlieの情報を更新
            ];
            const updateDto = SpreadSheetDto.create(spreadSheetId, testSheetName, columns, entitiesToUpdate);
            if (updateDto) {
                const updatedCount = GooogleSpreadSheetService.update(updateDto);
                Logger.log(`${updatedCount} 件のレコードを更新しました。`);
            } else {
                Logger.log("Update用DTOの作成に失敗しました。");
            }

            // 5. Select 操作のテスト (更新後確認)
            Logger.log("--- Select 操作のテスト (更新後確認) ---");
            const allEntitiesAfterUpdate = GooogleSpreadSheetService.select(selectQueryAll);
            Logger.log("更新後の全てのエンティティ:");
            if (allEntitiesAfterUpdate && allEntitiesAfterUpdate.length > 0) {
                allEntitiesAfterUpdate.forEach(e => Logger.log(JSON.stringify(e)));
            } else {
                Logger.log("更新後にエンティティが見つかりませんでした、またはSelectに失敗しました。");
            }

            // 6. Delete 操作のテスト (一括削除)
            Logger.log("--- Delete 操作のテスト ---");
            // Bob または idが"3"のエンティティを削除
            const deleteQuery = new SpreadSheetQuery(
                spreadSheetId,
                testSheetName,
                () => new TestEntity(),
                (entity) => entity.name === "Bob" || entity.id === "3"
            );
            const deletedCount = GooogleSpreadSheetService.delete(deleteQuery);
            Logger.log(`${deletedCount} 件のレコードを削除しました (空行化)。`);

            // 7. Select 操作のテスト (削除後確認)
            Logger.log("--- Select 操作のテスト (削除後確認) ---");
            const allEntitiesAfterDelete = GooogleSpreadSheetService.select(selectQueryAll);
            Logger.log("削除後の全てのエンティティ:");
            if (allEntitiesAfterDelete && allEntitiesAfterDelete.length > 0) {
                allEntitiesAfterDelete.forEach(e => Logger.log(JSON.stringify(e)));
            } else {
                Logger.log("削除後にエンティティが見つかりませんでした、またはSelectに失敗しました。");
            }

            Logger.log("--- SpreadSheetServiceTest 終了 ---");

        } catch (e: any) {
            Logger.log(`エラーが発生しました: ${e.message}`);
        }
    }
}

/**
 * Google Apps Scriptエディタから直接実行するためのグローバル関数です。
 * この関数を実行する前に、`SPREADSHEET_ID`を実際のGoogleスプレッドシートのIDに置き換えてください。
 */
export function runSpreadSheetServiceTest() {
    // ここにテストしたいGoogleスプレッドシートのIDを入力してください。
    // 例: const SPREADSHEET_ID = "1AbCdefGhIjKlMnOpQrStUvWXYZ1234567890";
    const SPREADSHEET_ID = "1CsbGHLha756BEp-J9FAJBgeaP7eSdh6SCVr2sUo-qC0";
    SpreadSheetServiceTest.run(SPREADSHEET_ID);
}
