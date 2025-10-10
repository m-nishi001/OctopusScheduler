import { injectable } from "tsyringe";
import { IAssetRepository } from "../../domain/assets/repository/asset-repository";
import { Asset } from "../../domain/assets/entity/asset";
import { AssetMetadata } from "../../domain/assets/vo/asset-metadata";
import { AssetType } from "../../domain/assets/vo/asset-type";
import { GoogleDriveService } from "../../../../shared-packages/src/google-drive-service";

@injectable()
export class AssetRepository implements IAssetRepository {
  private static readonly assetFolderId: string =
    PropertiesService.getScriptProperties().getProperty(
      "octopus-schedule-api-asset"
    ) ??
    (() => {
      throw new Error("Asset folder ID is not set in ScriptProperties.");
    })();

  add(asset: Asset): string {
    const uploadedFile = GoogleDriveService.uploadFile({
      fileName: asset.assetName,
      parentFolderId: AssetRepository.assetFolderId,
      mimeType: asset.assetData.getContentType() || "application/octet-stream",
      blob: asset.assetData,
    });

    if (!uploadedFile || !uploadedFile.id)
      throw new Error("Failed to retrieve uploaded file ID.");

    return uploadedFile.id;
  }

  getAllMetadatas(): AssetMetadata[] {
    const folderId = AssetRepository.assetFolderId;
    const files = DriveApp.getFolderById(folderId).getFiles();
    const metadatas: AssetMetadata[] = [];
    while (files.hasNext()) {
      const file = files.next();
      metadatas.push(
        new AssetMetadata(
          file.getId(),
          file.getName(),
          file.getMimeType(),
          file.getSize(),
          file.getDateCreated() as Date,
          file.getLastUpdated() as Date
        )
      );
    }
    return metadatas;
  }

  findById(assetId: string): Asset | null {
    try {
      const file = DriveApp.getFileById(assetId);
      return Asset.createFrom({
        assetId: file.getId(),
        assetName: file.getName(),
        assetType: new AssetType(file.getMimeType()),
        assetData: file.getBlob(),
        updatedAt: file.getLastUpdated() as Date,
      } as Asset);
    } catch (e) {
      return null;
    }
  }

  findAll(): Asset[] {
    const folderId = AssetRepository.assetFolderId;
    const files = DriveApp.getFolderById(folderId).getFiles();
    const assets: Asset[] = [];
    while (files.hasNext()) {
      const file = files.next();
      assets.push(
        Asset.createFrom({
          assetId: file.getId(),
          assetName: file.getName(),
          assetType: new AssetType(file.getMimeType()),
          assetData: file.getBlob(),
          updatedAt: file.getLastUpdated() as Date,
        } as Asset)
      );
    }
    return assets;
  }

  delete(assetId: string): void {
    GoogleDriveService.deleteFilesOrFolders([assetId.toString()]);
  }

  update(asset: Asset): void {
    const file = DriveApp.getFileById(asset.assetId);
    file.setName(asset.assetName);
  }
}
