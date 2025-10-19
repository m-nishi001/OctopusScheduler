import type { Asset } from "../../domains/assets/entity/asset";
import type { IAssetRepository } from "../../domains/assets/repository/asset-repository";
import type { DriveData } from "@octopus/server-common/drive-types";
import { injectable, inject } from "tsyringe";

@injectable()
export class AssetService {
  constructor(
    @inject("IAssetRepository") private assetRepository: IAssetRepository
  ) {}

  async addAssets(
    assets: Asset[],
    onProgress?: (
      index: number,
      status: "完了" | "失敗",
      message?: string
    ) => void
  ): Promise<string[]> {
    const driveData: DriveData[] = assets.map((a) => ({
      metadata: {
        driveDataId: a.id,
        fileId: "",
        parentFolderId: a.directoryId || "",
        lastUpdate: new Date(a.lastUpdated),
      },
      fileName: a.name,
      fileKind:
        a.type === "image"
          ? "image/*"
          : a.type === "video"
            ? "video/*"
            : a.type === "audio"
              ? "audio/*"
              : "text/plain",
      fileDataUrl: a.dataUrl,
      uploadDate: new Date(a.uploadedAt),
      parentFolderId: a.directoryId || "",
    }));
    return await this.assetRepository.addAssets(driveData, onProgress);
  }

  async getAssets(): Promise<Asset[]> {
    const drive = await this.assetRepository.getAssets();
    return drive.map((d) => ({
      id: d.metadata.driveDataId,
      type: d.fileKind.startsWith("image")
        ? "image"
        : d.fileKind.startsWith("video")
          ? "video"
          : d.fileKind.startsWith("audio")
            ? "audio"
            : "text",
      dataUrl: d.fileDataUrl,
      name: d.fileName,
      uploadedAt: d.uploadDate.toISOString(),
      lastUpdated: d.metadata.lastUpdate.toISOString(),
      size: 0,
      directoryId: d.metadata.parentFolderId || undefined,
    }));
  }

  async getAssetById(id: string): Promise<Asset | null> {
    const d = await this.assetRepository.getAssetById(id);
    if (!d) return null;
    return {
      id: d.metadata.driveDataId,
      type: d.fileKind.startsWith("image")
        ? "image"
        : d.fileKind.startsWith("video")
          ? "video"
          : d.fileKind.startsWith("audio")
            ? "audio"
            : "text",
      dataUrl: d.fileDataUrl,
      name: d.fileName,
      uploadedAt: d.uploadDate.toISOString(),
      lastUpdated: d.metadata.lastUpdate.toISOString(),
      size: 0,
      directoryId: d.metadata.parentFolderId || undefined,
    };
  }

  async deleteAssets(ids: string[]): Promise<void> {
    await this.assetRepository.deleteAssets(ids);
  }

  async syncAssets(onProgress?: (message: string) => void): Promise<void> {
    await this.assetRepository.syncAssets(onProgress);
  }
}
