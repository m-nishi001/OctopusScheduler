import { GoogleDriveService } from "./google-drive-service";
import { FileId } from "./value-object/file-id";
import { FileIdQuery } from "./value-object/file-id-query";
import { FileMimeType } from "./value-object/file-mime-type";
import { FileName } from "./value-object/file-name";
import { FileNameQuery } from "./value-object/file-name-query";
import { FolderId } from "./value-object/folder-id";
import { UploadData } from "./value-object/upload-data";

export function runDriveServiceTest() {
    Logger.log("--- DriveService テスト開始 ---");

    const TEST_FOLDER_NAME = "DriveServiceTestFolder_" + new Date().getTime();
    let testFolderId: FolderId | null = null;

    try {
        // Step 0: テスト用フォルダの作成
        Logger.log("テスト用フォルダを作成中...");
        const testFolder = DriveApp.createFolder(TEST_FOLDER_NAME);
        testFolderId = FolderId.create(testFolder.getId());
        if (!testFolderId) {
            Logger.log("エラー: テスト用フォルダIDの作成に失敗しました。テストを中断します。");
            return;
        }
        Logger.log(`テスト用フォルダ作成完了: ${TEST_FOLDER_NAME} (ID: ${testFolderId.id})`);

        // Step 1: 複数ファイルを生成
        Logger.log("\n--- Step 1: 複数ファイルの生成 ---");
        const fileNames = ["TestFile1.txt", "TestFile2.pdf", "TestFile3.jpg"];
        const createdFileIds: FileId[] = [];

        for (const name of fileNames) {
            const fileName = FileName.create(name);
            const mimeType = FileMimeType.create(name.split('.').pop() || "text/plain"); // 拡張子からMIMEタイプを推測
            const blob = Utilities.newBlob(`This is content for ${name}.`, mimeType?.getValue() || "text/plain", name);

            if (fileName && mimeType && testFolderId && blob) {
                const uploadData: UploadData = {
                    fileId: null, // 新規作成のためnull
                    fileName: fileName,
                    parentFolderId: testFolderId,
                    mimeType: mimeType,
                    blob: blob,
                };
                const createdFile = GoogleDriveService.uploadFile(uploadData);
                const fileId = FileId.create(createdFile.id!);
                if (fileId) {
                    createdFileIds.push(fileId);
                    Logger.log(`ファイル生成: ${createdFile.name} (ID: ${createdFile.id})`);
                } else {
                    Logger.log(`エラー: ファイルIDの作成に失敗しました: ${createdFile.name}`);
                }
            } else {
                Logger.log(`エラー: ファイル "${name}" のデータ作成に失敗しました。`);
            }
        }
        Logger.log(`生成されたファイルの数: ${createdFileIds.length}`);
        if (createdFileIds.length !== fileNames.length) {
            Logger.log("警告: 生成されたファイルの数が期待値と異なります。");
        }

        // Step 2: 生成したファイルの取得 (by name)
        Logger.log("\n--- Step 2: 生成したファイルの取得 (by name) ---");
        const queryFileName = FileName.create("TestFile1.txt");
        if (queryFileName) {
            const fileNameQuery: FileNameQuery = { fileName: queryFileName, parentFolderId: testFolderId };
            const foundFilesByName = GoogleDriveService.findFileByName(fileNameQuery);
            Logger.log(`'${queryFileName.name}' で見つかったファイル数: ${foundFilesByName.length}`);
            if (foundFilesByName.length > 0) {
                Logger.log(`見つかったファイル名: ${foundFilesByName[0].getName()}`);
            } else {
                Logger.log("エラー: TestFile1.txt が見つかりませんでした (by name)。");
            }
        }

        // Step 3: 生成したファイルの取得 (by id)
        Logger.log("\n--- Step 3: 生成したファイルの取得 (by id) ---");
        if (createdFileIds.length > 0 && testFolderId) {
            const fileIdQuery = FileIdQuery.create(createdFileIds, testFolderId);
            if (fileIdQuery) {
                const foundFilesById = GoogleDriveService.findFileById(fileIdQuery);
                Logger.log(`ID指定で見つかったファイル数: ${foundFilesById.length}`);
                if (foundFilesById.length === createdFileIds.length) {
                    Logger.log("全てのファイルがIDで正しく見つかりました。");
                } else {
                    Logger.log("エラー: ID指定で期待される数のファイルが見つかりませんでした。");
                }
            } else {
                Logger.log("エラー: FileIdQueryの作成に失敗しました。");
            }
        } else {
            Logger.log("エラー: 取得テストに必要なファイルIDまたはフォルダIDがありません。");
        }

        // Step 4: ファイルの更新 (1件)
        Logger.log("\n--- Step 4: ファイルの更新 (1件) ---");
        if (createdFileIds.length > 0 && testFolderId) {
            const fileToUpdateId = createdFileIds[0];
            const newContent = "Updated content for TestFile1.txt.";
            const updatedFileName = FileName.create("TestFile1_updated.txt");
            const updatedMimeType = FileMimeType.create("text/plain");
            const updatedBlob = Utilities.newBlob(newContent, updatedMimeType?.getValue() || "text/plain", updatedFileName?.name || "TestFile1_updated.txt");

            if (fileToUpdateId && updatedFileName && updatedMimeType && testFolderId && updatedBlob) {
                const updateData: UploadData = {
                    fileId: fileToUpdateId,
                    fileName: updatedFileName,
                    parentFolderId: testFolderId,
                    mimeType: updatedMimeType,
                    blob: updatedBlob,
                };
                const updatedFile = GoogleDriveService.uploadFile(updateData);
                Logger.log(`ファイル更新: ${updatedFile.name} (ID: ${updatedFile.id})`);
                if (updatedFile.name === updatedFileName.name) {
                    Logger.log("ファイル名が正しく更新されました。");
                } else {
                    Logger.log("エラー: ファイル名が期待通りに更新されませんでした。");
                }
            } else {
                Logger.log("エラー: ファイル更新に必要なデータが不足しています。");
            }
        } else {
            Logger.log("エラー: 更新テストに必要なファイルIDがありません。");
        }

        // Step 5: 更新後のファイルの取得 (by name)
        Logger.log("\n--- Step 5: 更新後のファイルの取得 (by name) ---");
        const updatedQueryFileName = FileName.create("TestFile1_updated.txt");
        if (updatedQueryFileName) {
            const updatedFileNameQuery: FileNameQuery = { fileName: updatedQueryFileName, parentFolderId: testFolderId };
            const foundUpdatedFiles = GoogleDriveService.findFileByName(updatedFileNameQuery);
            Logger.log(`'${updatedQueryFileName.name}' で見つかったファイル数: ${foundUpdatedFiles.length}`);
            if (foundUpdatedFiles.length > 0 && foundUpdatedFiles[0].getName() === updatedQueryFileName.name) {
                Logger.log("更新されたファイルが新しい名前で正しく見つかりました。");
            } else {
                Logger.log("エラー: 更新されたファイルが新しい名前で見つかりませんでした。");
            }
        }

        // Step 6: 1件ファイルを削除
        Logger.log("\n--- Step 6: 1件ファイルを削除 ---");
        if (createdFileIds.length > 1) { // 少なくとも2つのファイルがあることを確認
            const fileToDeleteId = createdFileIds[1]; // 2番目のファイルを削除対象とする
            const deleteResult = GoogleDriveService.deleteObjects([fileToDeleteId]);
            Logger.log(`ファイル '${fileToDeleteId.id}' の削除結果: ${deleteResult ? "成功" : "失敗"}`);
            if (!deleteResult) {
                Logger.log("エラー: ファイル削除に失敗しました。");
            }
        } else {
            Logger.log("スキップ: 削除するのに十分なファイルがありません。");
        }

        // Step 7: 削除後のファイルリストの取得 (フォルダ内)
        Logger.log("\n--- Step 7: 削除後のファイルリストの取得 (フォルダ内) ---");
        if (testFolderId) {
            const filesInFolder = DriveApp.getFolderById(testFolderId.id).getFiles();
            let remainingFileCount = 0;
            while (filesInFolder.hasNext()) {
                filesInFolder.next();
                remainingFileCount++;
            }
            Logger.log(`フォルダ '${TEST_FOLDER_NAME}' 内に残っているファイル数: ${remainingFileCount}`);
            // 元々3つファイルを作成し、1つ削除したので、残りは2つのはず
            if (remainingFileCount === 2) {
                Logger.log("ファイルが正しく削除されたことを確認しました。");
            } else {
                Logger.log("エラー: 削除後のファイル数が期待値と異なります。");
            }
        }

    } catch (e: any) {
        Logger.log(`予期せぬエラーが発生しました: ${e.message}`);
    } finally {
        // Step 8: テスト用フォルダの削除
        Logger.log("\n--- Step 8: テスト用フォルダのクリーンアップ ---");
        if (testFolderId) {
            const folderToDelete = DriveApp.getFolderById(testFolderId.id);
            try {
                // フォルダをゴミ箱に移動
                Drive.Files.update({ trashed: true }, folderToDelete.getId());
                Logger.log(`テスト用フォルダ '${TEST_FOLDER_NAME}' をゴミ箱に移動しました。`);
            } catch (e: any) {
                Logger.log(`エラー: テスト用フォルダ '${TEST_FOLDER_NAME}' の削除に失敗しました: ${e.message}`);
            }
        }
        Logger.log("--- DriveService テスト終了 ---");
    }
}