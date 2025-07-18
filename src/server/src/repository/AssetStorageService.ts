/**
 * @file AssetStorageService.ts
 * @description Google Driveへのアセットファイル（画像、音声など）の保存、削除を汎用的に行うサービス。
 * ImageStorageServiceとAudioStorageServiceの機能を統合したものです。
 */
export class AssetStorageService {
    private readonly folderId: string;

    /**
     * AssetStorageServiceのコンストラクタ。
     * スクリプトプロパティに登録されたキーを元に、アセットの保存先フォルダIDを取得します。
     * @param propertyKey - 保存先フォルダIDが登録されているスクリプトプロパティのキー (例: 'IMAGE_FOLDER_ID', 'AUDIO_FOLDER_ID')
     */
    constructor(propertyKey: string) {
        if (!propertyKey) {
            throw new Error('A property key for the folder ID must be provided.');
        }
        const folderId = PropertiesService.getScriptProperties().getProperty(propertyKey);
        if (!folderId) {
            throw new Error(`スクリプトプロパティに "${propertyKey}" が設定されていません。`);
        }
        this.folderId = folderId;
    }

    /**
     * Base64エンコードされたデータをGoogle Driveにファイルとして保存します。
     * @param fileName - 保存するファイル名
     * @param mimeType - ファイルのMIMEタイプ (例: 'image/png', 'audio/mpeg')
     * @param base64Data - Base64エンコードされたデータ。"data:[mimeType];base64,[data]" 形式を想定。
     * @returns 保存されたファイルのGoogle DriveにおけるID
     */
    public save(fileName: string, mimeType: string, base64Data: string): string {
        const folder = DriveApp.getFolderById(this.folderId);

        // "data:[mimeType];base64," のようなデータURLプレフィックスを削除します
        const pureBase64 = base64Data.substring(base64Data.indexOf(',') + 1);

        // Base64データをデコードしてBlobオブジェクトを作成します
        const decoded = Utilities.base64Decode(pureBase64);
        const blob = Utilities.newBlob(decoded, mimeType, fileName);

        // Driveにファイルを保存し、そのIDを返します
        const file = folder.createFile(blob);
        return file.getId();
    }

    /**
     * 指定されたファイルIDのファイルをGoogle Driveから削除（ゴミ箱へ移動）します。
     * @param fileId - 削除するファイルのID
     */
    public delete(fileId: string): void {
        try {
            const file = DriveApp.getFileById(fileId);
            // ファイルをゴミ箱に移動させます
            file.setTrashed(true);
            Logger.log(`File with id ${fileId} has been moved to trash.`);
        } catch (e) {
            // ファイルが存在しない場合など、何らかのエラーが発生した場合は警告をログに出力します。
            // これにより、すでに削除されているファイルを再度削除しようとしても、処理が停止しないようにします。
            console.warn(`Failed to delete file with id: ${fileId}. It may have already been deleted. Error: ${(e as Error).message}`);
        }
    }
}
