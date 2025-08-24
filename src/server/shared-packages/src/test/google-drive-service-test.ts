import { GoogleDriveService } from "../google-drive-service";

/**
 * テスト用のフォルダID
 * @see https://drive.google.com/drive/folders/1T1hWuTJxjX_pIheBRsQu-OIZBFFA-lQT
 */
const TEST_FOLDER_ID = "1T1hWuTJxjX_pIheBRsQu-OIZBFFA-lQT";
const ZIP_TEST_SUBFOLDER_NAME = "zip_test_" + new Date().getTime();

/**
 * GoogleDriveService.findFileByName() のテスト
 */
function testFindFileByName() {
    Logger.log("--- Start: testFindFileByName ---");

    // Test Case 1: 存在するファイル名と正しいフォルダIDを指定し、ファイルが見つかること
    try {
        const options = { fileName: "music1.mp3", parentFolderId: TEST_FOLDER_ID };
        const files = GoogleDriveService.findFileByName(options);
        if (files.length > 0) {
            Logger.log("Test Case 1 Passed: 'music1.mp3'が見つかりました。");
        } else {
            Logger.log("Test Case 1 Failed: 'music1.mp3'が見つかりませんでした。");
        }
    } catch (e: any) {
        Logger.log(`Test Case 1 Failed: 予期しないエラーが発生しました: ${e.message}`);
    }

    // Test Case 2: 存在しないファイル名を指定し、空の配列が返されること
    try {
        const options = { fileName: "non_existent_file.txt", parentFolderId: TEST_FOLDER_ID };
        const files = GoogleDriveService.findFileByName(options);
        if (files.length === 0) {
            Logger.log("Test Case 2 Passed: 存在しないファイル名で、正しく空の配列が返されました。");
        } else {
            Logger.log(`Test Case 2 Failed: 空の配列が期待されましたが、${files.length}個のファイルが見つかりました。`);
        }
    } catch (e: any) {
        Logger.log(`Test Case 2 Failed: 予期しないエラーが発生しました: ${e.message}`);
    }

    // Test Case 3: 無効なフォルダIDを指定し、空の配列が返されること
    try {
        const options = { fileName: "music1.mp3", parentFolderId: "invalid_id" };
        const files = GoogleDriveService.findFileByName(options);
        if (files.length === 0) {
            Logger.log("Test Case 3 Passed: 無効なフォルダIDで、正しく空の配列が返されました。");
        } else {
            Logger.log(`Test Case 3 Failed: 空の配列が期待されましたが、${files.length}個のファイルが見つかりました。`);
        }
    } catch (e: any) {
        Logger.log(`Test Case 3 Failed: 予期しないエラーが発生しました: ${e.message}`);
    }

    // Test Case 4: 無効なファイル名を指定し、空の配列が返されること
    try {
        const options = { fileName: "", parentFolderId: TEST_FOLDER_ID };
        const files = GoogleDriveService.findFileByName(options);
        if (files.length === 0) {
            Logger.log("Test Case 4 Passed: 無効なファイル名で、正しく空の配列が返されました。");
        } else {
            Logger.log(`Test Case 4 Failed: 空の配列が期待されましたが、${files.length}個のファイルが見つかりました。`);
        }
    } catch (e: any) {
        Logger.log(`Test Case 4 Failed: 予期しないエラーが発生しました: ${e.message}`);
    }

    Logger.log("--- End: testFindFileByName ---");
}

/**
 * GoogleDriveService.findFileByIds() と findFileDataByIds() のテスト
 */
function testFindFileByIdsAndData() {
    Logger.log("--- Start: testFindFileByIdsAndData ---");
    let testFolder: GoogleAppsScript.Drive.Folder | null = null;
    let fileIdsToCleanUp: string[] = [];

    // Setup: テスト用のファイルを一時的に作成
    try {
        testFolder = DriveApp.getFolderById(TEST_FOLDER_ID).createFolder("TempTestFolder_" + new Date().getTime());
        const file1 = testFolder.createFile("test_file_1.txt", "content 1", "text/plain");
        const file2 = testFolder.createFile("test_file_2.txt", "content 2", "text/plain");
        fileIdsToCleanUp.push(file1.getId(), file2.getId());

        // Test Case 1: 存在するファイルIDを指定してファイルが見つかること
        const foundFiles = GoogleDriveService.findFileByIds({ fileIds: fileIdsToCleanUp, parentFolderId: testFolder.getId() });
        if (foundFiles.length === 2 && foundFiles.some(f => f.getId() === file1.getId())) {
            Logger.log("Test Case 1 Passed: IDでファイルが正常に見つかりました。");
        } else {
            Logger.log("Test Case 1 Failed: IDによるファイル検索に失敗しました。");
        }

        // Test Case 2: 存在するファイルIDを指定してファイルデータ（Blob）が取得できること
        const foundData = GoogleDriveService.findFileDataByIds({ fileIds: fileIdsToCleanUp, parentFolderId: testFolder.getId() });
        if (foundData.length === 2 && foundData.some(b => b.getDataAsString() === "content 1")) {
            Logger.log("Test Case 2 Passed: IDでファイルデータが正常に取得されました。");
        } else {
            Logger.log("Test Case 2 Failed: IDによるファイルデータ取得に失敗しました。");
        }

        // Test Case 3: 存在しないIDを指定した場合、空の配列が返されること
        const nonExistentIds = ["non_existent_id_1", "non_existent_id_2"];
        const notFoundFiles = GoogleDriveService.findFileByIds({ fileIds: nonExistentIds, parentFolderId: testFolder.getId() });
        if (notFoundFiles.length === 0) {
            Logger.log("Test Case 3 Passed: 存在しないIDで正しく空の配列が返されました。");
        } else {
            Logger.log("Test Case 3 Failed: 存在しないIDでファイルが見つかってしまいました。");
        }
    } catch (e: any) {
        Logger.log(`Test Failed during execution: ${e.message}`);
    } finally {
        // Cleanup: 作成したファイルとフォルダを削除
        if (testFolder) {
            GoogleDriveService.deleteFilesOrFolders([testFolder.getId()]);
            Logger.log("Cleanup: 作成した一時フォルダとファイルを削除しました。");
        }
    }

    Logger.log("--- End: testFindFileByIdsAndData ---");
}

/**
 * GoogleDriveService.uploadFile() および deleteFilesOrFolders() のテスト
 */
function testUploadAndDeleteFile() {
    Logger.log("--- Start: testUploadAndDeleteFile ---");
    let uploadedFileId = "";

    // Test Case 1: 新規ファイルとしてアップロードが成功すること
    try {
        const options = {
            fileName: "test_upload_file.txt",
            parentFolderId: TEST_FOLDER_ID,
            mimeType: "text/plain",
            blob: Utilities.newBlob("Hello, World!", "text/plain")
        };
        const result = GoogleDriveService.uploadFile(options);
        if (result && result.id) {
            uploadedFileId = result.id;
            Logger.log("Test Case 1 Passed: 新規ファイルが正常にアップロードされました。");
        } else {
            Logger.log("Test Case 1 Failed: 新規ファイルのアップロードに失敗しました。");
        }
    } catch (e: any) {
        Logger.log(`Test Case 1 Failed: 予期しないエラーが発生しました: ${e.message}`);
    }

    // Test Case 2: アップロードしたファイルを削除できること
    if (uploadedFileId) {
        try {
            const result = GoogleDriveService.deleteFilesOrFolders([uploadedFileId]);
            if (result) {
                Logger.log("Test Case 2 Passed: アップロードしたファイルが正常に削除されました。");
            } else {
                Logger.log("Test Case 2 Failed: ファイルの削除に失敗しました。");
            }
        } catch (e: any) {
            Logger.log(`Test Case 2 Failed: 予期しないエラーが発生しました: ${e.message}`);
        }
    }

    Logger.log("--- End: testUploadAndDeleteFile ---");
}

/**
 * GoogleDriveService.readyZipping() と zip() のテスト
 */
function testZipping() {
    Logger.log("--- Start: testZipping ---");
    let testFolder: GoogleAppsScript.Drive.Folder | null = null;
    let parentFolderId: string | null = null;
    let zipConfigFileName = "";

    try {
        // Setup: テスト用のサブフォルダを作成し、テストファイルを配置
        testFolder = DriveApp.getFolderById(TEST_FOLDER_ID).createFolder(ZIP_TEST_SUBFOLDER_NAME);
        parentFolderId = testFolder.getId();
        const file1 = testFolder.createFile("zip_test_1.txt", "1234567890", "text/plain"); // 10 bytes
        const file2 = testFolder.createFile("zip_test_2.txt", "12345", "text/plain");    // 5 bytes
        const file3 = testFolder.createFile("zip_test_3.txt", "12345678901234567890", "text/plain"); // 20 bytes
        const file4 = testFolder.createFile("zip_test_4.txt", "1234567890", "text/plain"); // 10 bytes

        // Test Case 1: readyZippingが正常に動作し、正しい分割数が返されること
        const partitionSize = 25; // 25 bytes
        const partitionCount = GoogleDriveService.readyZipping({ folderId: parentFolderId, partitionSizeInBytes: partitionSize });
        if (partitionCount > 0) {
            Logger.log(`Test Case 1 Passed: readyZippingが正常に動作し、${partitionCount}件の分割数が返されました。`);
        } else {
            Logger.log("Test Case 1 Failed: readyZippingの実行に失敗しました。");
        }

        // zip config file name is hardcoded in the original code
        zipConfigFileName = "zip-ready-config.json";
        const foundFiles = testFolder.getFilesByName(zipConfigFileName);
        if (foundFiles.hasNext()) {
            Logger.log("Test Case 1 Passed: 設定ファイルが正常に作成されました。");
        } else {
            Logger.log("Test Case 1 Failed: 設定ファイルが見つかりませんでした。");
        }

        // Test Case 2: zipが正常に動作し、指定されたシーケンス番号のZIPファイルが作成されること
        const sequence = 0;
        const zipResult = GoogleDriveService.zip({ folderId: parentFolderId, sequence: sequence });
        if (zipResult) {
            Logger.log(`Test Case 2 Passed: シーケンス番号 ${sequence} のZIPファイルが正常に作成されました。`);
        } else {
            Logger.log(`Test Case 2 Failed: ZIPファイルの作成に失敗しました。`);
        }

    } catch (e: any) {
        Logger.log(`Test Failed during execution: ${e.message}`);
    } finally {
        // Cleanup: 作成したファイルとフォルダを削除
        if (testFolder) {
            // ZIPファイルと設定ファイルも一緒に削除する
            const zipFiles = testFolder.getFilesByName(ZIP_TEST_SUBFOLDER_NAME + "_zip_0.zip");
            while (zipFiles.hasNext()) {
                zipFiles.next().setTrashed(true);
            }
            const configFile = testFolder.getFilesByName("zip-ready-config.json");
            while (configFile.hasNext()) {
                configFile.next().setTrashed(true);
            }
            GoogleDriveService.deleteFilesOrFolders([testFolder.getId()]);
            Logger.log("Cleanup: 作成した一時フォルダとファイルを削除しました。");
        }
    }

    Logger.log("--- End: testZipping ---");
}
