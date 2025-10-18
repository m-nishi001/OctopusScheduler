import type { DriveData, DriveMetadata, OperationResult } from "./drive-types";

export class GoogleDriveService {
  private cache: GoogleAppsScript.Cache.Cache;

  constructor() {
    this.cache = CacheService.getScriptCache();
  }
  addDriveData(driveData: DriveData): OperationResult<DriveMetadata> {
    const driveDataId = driveData.metadata.driveDataId;
    const cacheKey = driveDataId;
    const currentStatus = this.cache.get(cacheKey);

    if (currentStatus === "saved") {
      return {
        status: "duplicate",
        message: `DriveData with ID ${driveDataId} is already saved.`,
      };
    }
    if (currentStatus === "saving") {
      return {
        status: "error",
        message: `DriveData with ID ${driveDataId} is currently being saved.`,
      };
    }

    this.cache.put(cacheKey, "saving", 3600); // 1 hour expiration

    try {
      const blob = Utilities.newBlob(
        Utilities.base64Decode(driveData.fileDataUrl),
        driveData.fileKind,
        driveData.fileName
      );
      const folder = DriveApp.getFolderById(driveData.parentFolderId);
      const file = folder.createFile(blob);
      file.setName(`${driveDataId}_${driveData.fileName}`);
      const metadata: DriveMetadata = {
        driveDataId,
        fileId: file.getId(),
        parentFolderId: file.getParents().next().getId(),
        lastUpdate: new Date(file.getLastUpdated().getTime()),
        size: file.getSize(),
      };
      this.cache.put(cacheKey, "saved", 3600);
      return { status: "success", data: metadata };
    } catch (error) {
      this.cache.remove(cacheKey);
      return { status: "error", message: (error as Error).message };
    }
  }

  getDriveMetaData(folderId: string): DriveMetadata[] {
    const folder = DriveApp.getFolderById(folderId);
    const metadata: DriveMetadata[] = [];
    // Add files in current folder
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();
      const driveDataId = fileName.split("_")[0];
      metadata.push({
        driveDataId,
        fileId: file.getId(),
        parentFolderId: folderId,
        lastUpdate: new Date(file.getLastUpdated().getTime()),
        size: file.getSize(),
      });
    }
    // Recursively add files in subfolders
    const subFolders = folder.getFolders();
    while (subFolders.hasNext()) {
      const subFolder = subFolders.next();
      const subMetadata = this.getDriveMetaData(subFolder.getId());
      metadata.push(...subMetadata);
    }
    return metadata;
  }

  getDriveData(dataId: string): DriveData | null {
    try {
      const file = DriveApp.getFileById(dataId);
      const blob = file.getBlob();
      const dataUrl = Utilities.base64Encode(blob.getBytes());
      const fullFileName = file.getName();
      const driveDataId = fullFileName.split("_")[0];
      const fileName = fullFileName.split("_").slice(1).join("_");
      const parentFolderId = file.getParents().next().getId();
      const metadata: DriveMetadata = {
        driveDataId,
        fileId: dataId,
        parentFolderId,
        lastUpdate: new Date(file.getLastUpdated().getTime()),
        size: file.getSize(),
      };
      return {
        metadata,
        fileName,
        fileKind: file.getMimeType(),
        fileDataUrl: dataUrl,
        uploadDate: new Date(file.getDateCreated().getTime()),
        parentFolderId,
      };
    } catch {
      return null;
    }
  }

  removeDriveData(dataId: string): void {
    try {
      const file = DriveApp.getFileById(dataId);
      const fileName = file.getName();
      const driveDataId = fileName.split("_")[0];
      file.setTrashed(true);
      this.cache.remove(driveDataId);
    } catch {
      // Ignore if file not found
    }
  }

  updateDriveData(driveData: DriveData): OperationResult<void> {
    const driveDataId = driveData.metadata.driveDataId;
    const cacheKey = driveDataId;
    const currentStatus = this.cache.get(cacheKey);

    if (currentStatus !== "saved") {
      return {
        status: "error",
        message: `DriveData with ID ${driveDataId} is not saved or is being processed.`,
      };
    }

    this.cache.put(cacheKey, "updating", 3600);

    try {
      const file = DriveApp.getFileById(driveData.metadata.fileId);
      const blob = Utilities.newBlob(
        Utilities.base64Decode(driveData.fileDataUrl),
        driveData.fileKind,
        driveData.fileName
      );
      file.setContent(blob.getDataAsString());
      file.setName(`${driveDataId}_${driveData.fileName}`);
      this.cache.put(cacheKey, "saved", 3600);
      return { status: "success" };
    } catch (error) {
      this.cache.remove(cacheKey);
      return { status: "error", message: (error as Error).message };
    }
  }
}
