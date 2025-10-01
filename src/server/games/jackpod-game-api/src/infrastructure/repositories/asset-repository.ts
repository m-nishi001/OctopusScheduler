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
  private assetTypeToMimeTypeMap: Record<string, string> = {
    image: "image/png",
    video: "video/mp4",
    audio: "audio/mp3",
    text: "text/plain",
  };

  uploadAsset(asset: Asset): string {
    const blob = this.convertToBlobFromDataUrl(
      asset.dataUrl,
      asset.name,
      asset.type
    );
    const folderId = getAssetFolderId();
    const file = GoogleDriveService.uploadFile({
      fileName: asset.name,
      parentFolderId: folderId,
      mimeType: this.getMimeTypeFromAssetType(asset.type),
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
    return this.mapFileToAsset(file);
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
      const files = this.listAssets();
      return files.map((file) => this.mapFileToAsset(file));
    } catch (error) {
      console.error("[AssetRepository] Error in findAll:", error);
      return [];
    }
  }

  findAllIds(): string[] {
    const folderId = getAssetFolderId();
    if (!folderId) {
      console.warn(
        "[AssetRepository] jackpot-game-asset-folder-id is not set in script properties."
      );
      return [];
    }
    try {
      const files = this.listAssets();
      return files.map((file) => file.getId());
    } catch (error) {
      console.error("[AssetRepository] Error in findAllIds:", error);
      return [];
    }
  }

  updateAsset(id: string, updateAsset: (asset: Asset) => Asset): string {
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

  private convertToBlobFromDataUrl(
    dataUrl: string,
    assetName: string,
    assetType: string
  ): GoogleAppsScript.Base.Blob {
    const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3)
      throw new Error("Invalid data URL format.");
    const base64Data = matches[2];
    const decodedData = Utilities.base64Decode(base64Data);
    return Utilities.newBlob(
      decodedData,
      this.getMimeTypeFromAssetType(assetType),
      assetName
    );
  }

  private getMimeTypeFromAssetType(assetType: string): string {
    return this.assetTypeToMimeTypeMap[assetType] || "text/plain";
  }

  private getAssetTypeFromMimeType(
    mimeType: string
  ): "image" | "video" | "audio" | "text" {
    const mainType = mimeType.split("/")[0];
    switch (mainType) {
      case "image":
        return "image";
      case "video":
        return "video";
      case "audio":
        return "audio";
      default:
        return "text";
    }
  }

  private generateDataUrlFromBlob(blob: GoogleAppsScript.Base.Blob): string {
    const bytes = blob.getBytes();
    const base64Data = Utilities.base64Encode(bytes);
    return "data:" + blob.getContentType() + ";base64," + base64Data;
  }

  private mapFileToAsset(file: GoogleAppsScript.Drive.File): Asset {
    const type = this.getAssetTypeFromMimeType(file.getMimeType());
    const blob = file.getBlob();
    const dataUrl = this.generateDataUrlFromBlob(blob);
    return {
      id: file.getId(),
      type,
      dataUrl: dataUrl,
      name: file.getName(),
      uploadedAt: file.getDateCreated().toISOString(),
      size: file.getSize(),
      meta: {},
    };
  }

  private listAssets(): GoogleAppsScript.Drive.File[] {
    const folderId = getAssetFolderId();
    const folder = DriveApp.getFolderById(folderId);
    const fileIterator = folder.getFiles();
    const files: GoogleAppsScript.Drive.File[] = [];
    while (fileIterator.hasNext()) {
      files.push(fileIterator.next());
    }
    return files;
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
