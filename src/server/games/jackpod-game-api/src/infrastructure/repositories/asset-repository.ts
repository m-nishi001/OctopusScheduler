import { GoogleDriveService } from "../../../../../shared-packages/src/google-drive-service";

export class AssetRepository {
  private static readonly assetFolderId: string = PropertiesService
    .getScriptProperties()
    .getProperty('jackpod-game-api-asset') ?? (() => { throw new Error('Asset folder ID is not set in ScriptProperties.'); })();

  static uploadAsset(fileName: string, mimeType: string, blob: GoogleAppsScript.Base.Blob): string {
    const uploadedFile = GoogleDriveService.uploadFile({
      fileName,
      parentFolderId: AssetRepository.assetFolderId,
      mimeType,
      blob
    });
    if (!uploadedFile || !uploadedFile.id) throw new Error('Failed to retrieve uploaded file ID.');
    return uploadedFile.id;
  }

  static deleteAsset(assetId: string): void {
    GoogleDriveService.deleteFilesOrFolders([assetId]);
  }

  static getAssetById(assetId: string): GoogleAppsScript.Drive.File | null {
    try {
      return DriveApp.getFileById(assetId);
    } catch (e) {
      return null;
    }
  }

  static listAssets(): GoogleAppsScript.Drive.File[] {
    const files = DriveApp.getFolderById(AssetRepository.assetFolderId).getFiles();
    const result: GoogleAppsScript.Drive.File[] = [];
    while (files.hasNext()) {
      result.push(files.next());
    }
    return result;
  }
}
