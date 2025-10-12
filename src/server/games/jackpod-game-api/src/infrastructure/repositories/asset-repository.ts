import { Asset } from "../../domain/asset/asset";
import type { IAssetRepository as IAssetRepository } from "../../domain/asset/asset-repository";
import { GoogleDriveService } from "../../../../../shared-packages/src/google-drive-service";
import type { AssetMetadataDto } from "../../applications/asset/asset-dto";
import { SpreadsheetService } from "../../../../../shared-packages/src/google-spreadsheet-service";
import { AssetInfo } from "../../applications/asset/asset-dto";

export class AssetRepository implements IAssetRepository {
  private readonly spreadsheetService =
    SpreadsheetService.getService<AssetInfo>("AssetInfo");

  addAssets(assets: Asset[]): string[] {
    const assetIds = assets.map((asset) => {
      if (asset.id) {
        // Update existing asset: delete old and upload new
        this.deleteAssets([asset.id]);
        return this.uploadAsset(asset);
      } else {
        // Upload new asset
        return this.uploadAsset(asset);
      }
    });
    // Add to spreadsheet
    const transaction = this.spreadsheetService.beginTransaction();
    const assetInfos = assetIds.map((id, index) => {
      const asset = assets[index];
      return new AssetInfo(
        id,
        asset.type,
        asset.name,
        asset.referenceFrom || []
      );
    });
    transaction.addMany(assetInfos);
    transaction.commit();
    return assetIds;
  }

  getAllAssets(): Asset[] {
    const folderId = this.getAssetFolderId();
    if (!folderId) return [];
    const files = this.listAssets();
    const assetInfos = this.spreadsheetService.find(() => true);
    const assetInfoMap = new Map(
      assetInfos.map((info) => [info.assetId, info])
    );
    return files.map((file) => {
      const asset = this.mapFileToAsset(file);
      const info = assetInfoMap.get(asset.id);
      asset.referenceFrom = info ? info.referenceFrom : [];
      return asset;
    });
  }

  getAssetById(id: string): Asset | null {
    const folderId = this.getAssetFolderId();
    const files = GoogleDriveService.findFileByIds({
      fileIds: [id],
      parentFolderId: folderId,
    });
    if (files.length === 0) return null;
    const file = files[0];
    const asset = this.mapFileToAsset(file);
    const info = this.spreadsheetService.findOne((info) => info.assetId === id);
    asset.referenceFrom = info ? info.referenceFrom : [];
    return asset;
  }

  getAllAssetMetadata(): AssetMetadataDto[] {
    const folderId = this.getAssetFolderId();
    if (!folderId) return [];
    const files = this.listAssets();
    return files.map((file) => this.mapFileToAssetMetadata(file));
  }

  deleteAssets(ids: string[]): void {
    GoogleDriveService.deleteFilesOrFolders(ids);
    this.spreadsheetService.delete((info) => ids.includes(info.assetId));
  }

  registerRef(assetId: string, refSourceId: string): void {
    this.spreadsheetService.update(
      (info) => info.assetId === assetId,
      (info) => {
        if (!info.referenceFrom.includes(refSourceId)) {
          info.referenceFrom.push(refSourceId);
        }
        return info;
      }
    );
  }

  unregisterRef(assetId: string, refSourceId: string): void {
    this.spreadsheetService.update(
      (info) => info.assetId === assetId,
      (info) => {
        info.referenceFrom = info.referenceFrom.filter(
          (id) => id !== refSourceId
        );
        return info;
      }
    );
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
      referenceFrom: [],
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

  private uploadAsset(asset: Asset): string {
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
}
