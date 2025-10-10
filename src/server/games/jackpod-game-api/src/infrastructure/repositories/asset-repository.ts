import { Asset } from "../../domain/asset/asset";
import type { IAssetRepository as IAssetRepository } from "../../domain/asset/asset-repository";
import { GoogleDriveService } from "../../../../../shared-packages/src/google-drive-service";
import type { AssetMetadataDto } from "../../applications/asset/asset-dto";

export class AssetRepository implements IAssetRepository {
  findAll(): Asset[] {
    const folderId = this.getAssetFolderId();
    if (!folderId) return [];
    const files = this.listAssets();
    return files.map((file) => this.mapFileToAsset(file));
  }

  findAllIds(): string[] {
    const folderId = this.getAssetFolderId();
    if (!folderId) return [];
    const files = this.listAssets();
    return files.map((file) => file.getId());
  }

  findAllMetadata(): AssetMetadataDto[] {
    const folderId = this.getAssetFolderId();
    if (!folderId) return [];
    const files = this.listAssets();
    return files.map((file) => this.mapFileToAssetMetadata(file));
  }

  getAsset(id: string): Asset | null {
    const folderId = this.getAssetFolderId();
    const files = GoogleDriveService.findFileByIds({
      fileIds: [id],
      parentFolderId: folderId,
    });
    if (files.length === 0) return null;
    const file = files[0];
    return this.mapFileToAsset(file);
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
    return ids.map((id) => this.updateAsset(id, updateAsset));
  }

  uploadAsset(asset: Asset): string {
    const blob = this.convertToBlobFromDataUrl(asset.dataUrl, asset.name);
    const folderId = this.getAssetFolderId();
    const file = GoogleDriveService.uploadFile({
      fileName: asset.name,
      parentFolderId: folderId,
      mimeType: blob.getContentType() || "text/plain",
      blob: blob,
    });
    return file ? file.id || "" : "";
  }

  deleteAsset(id: string): void {
    GoogleDriveService.deleteFilesOrFolders([id]);
  }

  private convertToBlobFromDataUrl(
    dataUrl: string,
    assetName: string
  ): GoogleAppsScript.Base.Blob {
    const base64Data = dataUrl.split(",")[1];
    const mimeType = dataUrl.split(",")[0].split(":")[1].split(";")[0];
    const decodedData = Utilities.base64Decode(base64Data);
    return Utilities.newBlob(decodedData, mimeType, assetName);
  }

  private generateDataUrlFromBlob(blob: GoogleAppsScript.Base.Blob): string {
    const bytes = blob.getBytes();
    const base64Data = Utilities.base64Encode(bytes);
    return "data:" + blob.getContentType() + ";base64," + base64Data;
  }

  private getAssetFolderId(): string {
    const props = PropertiesService.getScriptProperties();
    const folderId = props.getProperty("jackpot-game-asset-folder-id");
    if (!folderId) {
      throw new Error(
        "jackpot-game-asset-folder-id is not set in script properties."
      );
    }
    return folderId;
  }

  private listAssets(): GoogleAppsScript.Drive.File[] {
    const folderId = this.getAssetFolderId();
    const folder = DriveApp.getFolderById(folderId);
    const fileIterator = folder.getFiles();
    const files: GoogleAppsScript.Drive.File[] = [];
    while (fileIterator.hasNext()) {
      files.push(fileIterator.next());
    }
    return files;
  }

  private mapFileToAsset(file: GoogleAppsScript.Drive.File): Asset {
    const mimeType = file.getMimeType();
    const type = mimeType.split("/")[0] as "image" | "video" | "audio" | "text";
    const blob = file.getBlob();
    const dataUrl = this.generateDataUrlFromBlob(blob);
    return {
      id: file.getId(),
      type,
      dataUrl: dataUrl,
      name: file.getName(),
      uploadedAt: file.getDateCreated().toISOString(),
      lastUpdated: file.getLastUpdated().toISOString(),
      size: file.getSize(),
    };
  }

  private mapFileToAssetMetadata(
    file: GoogleAppsScript.Drive.File
  ): AssetMetadataDto {
    const mimeType = file.getMimeType();
    const type = mimeType.split("/")[0] as "image" | "video" | "audio" | "text";
    return {
      id: file.getId(),
      type,
      name: file.getName(),
      uploadedAt: file.getDateCreated().toISOString(),
      lastUpdated: file.getLastUpdated().toISOString(),
      size: file.getSize(),
    };
  }
}
