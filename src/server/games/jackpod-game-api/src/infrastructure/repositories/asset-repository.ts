import { Asset } from "../../domain/entities/asset";
import type { IAssetRepository as IAssetRepository } from "../../domain/repositories/asset-repository";
import { GoogleDriveService } from "../../../../../shared-packages/src/google-drive-service";

function getAssetFolderId(): string {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty("jackpot-game-asset-folder-id");
  if (!folderId) {
    throw new Error(
      "jackpot-game-asset-folder-id is not set in script properties."
    );
  }
  return folderId;
}

export class AssetRepositoryImpl implements IAssetRepository {
  uploadAsset(asset: Asset): string {
    // asset.url is assumed to be a dataUrl
    const blob = AssetRepositoryImplStatic.convertToBlobFromDataUrl(
      asset.url,
      asset.name,
      asset.type
    );
    const folderId = getAssetFolderId();
    const file = GoogleDriveService.uploadFile({
      fileName: asset.name,
      parentFolderId: folderId,
      mimeType: asset.type,
      blob: blob,
    });
    return file ? file.id || "" : "";
  }

  getAsset(id: string): Asset | null {
    const folderId = getAssetFolderId();
    const files = GoogleDriveService.findFileByIds({
      fileIds: [id],
      parentFolderId: folderId,
    });
    if (files.length === 0) return null;
    const file = files[0];
    // Map mimeType to Asset.type
    let type: "image" | "video" | "audio" | "text" = "text";
    const mimeType = file.getMimeType();
    if (mimeType.startsWith("image/")) type = "image";
    else if (mimeType.startsWith("video/")) type = "video";
    else if (mimeType.startsWith("audio/")) type = "audio";
    else type = "text";
    return {
      id: file.getId(),
      type,
      url: "", // Optionally, generate a download URL or dataUrl
      name: file.getName(),
      uploadedAt: "", // Optionally, get created date
      size: file.getSize(),
      meta: {},
    };
  }

  findAll(): Asset[] {
    const folderId = getAssetFolderId();
    if (!folderId) {
      console.warn(
        "[AssetRepository] jackpot-game-asset-folder-id is not set in script properties."
      );
      return [];
    }
    try {
      const files = AssetRepositoryImplStatic.listAssets();
      return files.map((file) => {
        let type: "image" | "video" | "audio" | "text" = "text";
        const mimeType = file.getMimeType();
        if (mimeType.startsWith("image/")) type = "image";
        else if (mimeType.startsWith("video/")) type = "video";
        else if (mimeType.startsWith("audio/")) type = "audio";
        else type = "text";
        return {
          id: file.getId(),
          type,
          url: file.getDownloadUrl(),
          name: file.getName(),
          uploadedAt: file.getDateCreated().toISOString(),
          size: file.getSize(),
          meta: {},
        };
      });
    } catch (error) {
      console.error("[AssetRepository] Error in findAll:", error);
      return [];
    }
  }

  updateAsset(id: string, updateAsset: (asset: Asset) => Asset): string {
    // Fetch asset, update, and re-upload
    const asset = this.getAsset(id);
    if (!asset) return "";
    const updated = updateAsset(asset);
    return this.uploadAsset(updated);
  }

  updateManyAssets(
    ids: string[],
    updateAsset: (asset: Asset) => Asset
  ): string[] {
    const results: string[] = [];
    for (const id of ids) {
      const updatedId = this.updateAsset(id, updateAsset);
      results.push(updatedId);
    }
    return results;
  }
}

// Static utility methods for legacy GAS API compatibility
export class AssetRepositoryImplStatic {
  static convertToBlobFromDataUrl(
    dataUrl: string,
    assetName: string,
    mimeType?: string
  ): GoogleAppsScript.Base.Blob {
    const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3)
      throw new Error("Invalid data URL format.");
    const base64Data = matches[2];
    const decodedData = Utilities.base64Decode(base64Data);
    return Utilities.newBlob(decodedData, mimeType || matches[1], assetName);
  }
  static uploadAsset(
    fileName: string,
    mimeType: string,
    blob: GoogleAppsScript.Base.Blob
  ): string {
    const folderId = getAssetFolderId();
    const file = GoogleDriveService.uploadFile({
      fileName,
      parentFolderId: folderId,
      mimeType,
      blob,
    });
    return file ? file.id || "" : "";
  }
  static deleteAsset(assetId: string): void {
    GoogleDriveService.deleteFilesOrFolders([assetId]);
  }
  static getAssetById(assetId: string): GoogleAppsScript.Drive.File | null {
    const folderId = getAssetFolderId();
    const files = GoogleDriveService.findFileByIds({
      fileIds: [assetId],
      parentFolderId: folderId,
    });
    return files.length > 0 ? files[0] : null;
  }
  static listAssets(): GoogleAppsScript.Drive.File[] {
    // List all files in the asset folder
    const folderId = getAssetFolderId();
    if (!folderId) {
      console.warn(
        "[AssetRepository] jackpot-game-asset-folder-id is not set in script properties."
      );
      return [];
    }
    try {
      const folder = DriveApp.getFolderById(folderId);
      const fileIterator = folder.getFiles();
      const files: GoogleAppsScript.Drive.File[] = [];
      while (fileIterator.hasNext()) {
        files.push(fileIterator.next());
      }
      return files;
    } catch (error) {
      console.error("[AssetRepository] Error in listAssets:", error);
      return [];
    }
  }
}
