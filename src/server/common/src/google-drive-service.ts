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
      const blob = this.createBlobFromDataUrlOrBase64(
        driveData.fileDataUrl || "",
        driveData.fileKind,
        driveData.fileName
      );

      const file = this.createFileInFolder(
        driveData.parentFolderId,
        blob,
        driveDataId,
        driveData.fileName
      );
      const metadata = this.buildMetadataFromFile(
        file,
        driveDataId,
        driveData.parentFolderId
      );

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
        lastUpdate: new Date(file.getLastUpdated().getTime()).toISOString(),
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
      // Return a data URL (data:<mime>;base64,<payload>) so clients can directly use it.
      const dataUrl = this.blobToDataUrl(
        blob,
        file.getMimeType() || "application/octet-stream"
      );
      const fullFileName = file.getName();
      const driveDataId = fullFileName.split("_")[0];
      const fileName = fullFileName.split("_").slice(1).join("_");
      const parentFolderId = file.getParents().next().getId();
      const metadata: DriveMetadata = {
        driveDataId,
        fileId: dataId,
        parentFolderId,
        lastUpdate: new Date(file.getLastUpdated().getTime()).toISOString(),
        size: file.getSize(),
      };
      return {
        metadata,
        fileName,
        fileKind: file.getMimeType(),
        fileDataUrl: dataUrl,
        // represent uploadDate as ISO string
        uploadDate: new Date(file.getDateCreated().getTime()).toISOString(),
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
      const blob = this.createBlobFromDataUrlOrBase64(
        driveData.fileDataUrl || "",
        driveData.fileKind,
        driveData.fileName
      );
      this.replaceFileContent(file, blob, driveDataId, driveData.fileName);
      this.cache.put(cacheKey, "saved", 3600);
      return { status: "success" };
    } catch (error) {
      this.cache.remove(cacheKey);
      return { status: "error", message: (error as Error).message };
    }
  }

  // --- Helpers (SRP) ---
  private extractBase64FromDataUrl(dataUrlOrBase64: string): string {
    const data = dataUrlOrBase64 || "";
    const m = data.match(/^data:(.*?);base64,(.*)$/);
    if (m) return m[2];
    return data;
  }

  private createBlobFromDataUrlOrBase64(
    baseOrDataUrl: string,
    mime: string,
    name: string
  ) {
    const base64 = this.extractBase64FromDataUrl(baseOrDataUrl);
    const bytes = Utilities.base64Decode(base64);
    return Utilities.newBlob(bytes, mime, name);
  }

  private createFileInFolder(
    folderId: string,
    blob: GoogleAppsScript.Base.Blob,
    driveDataId: string,
    fileName: string
  ) {
    const folder = DriveApp.getFolderById(folderId);
    const file = folder.createFile(blob);
    file.setName(`${driveDataId}_${fileName}`);
    return file;
  }

  private buildMetadataFromFile(
    file: GoogleAppsScript.Drive.File,
    driveDataId: string,
    parentFolderId: string
  ): DriveMetadata {
    return {
      driveDataId,
      fileId: file.getId(),
      parentFolderId: parentFolderId,
      lastUpdate: new Date(file.getLastUpdated().getTime()).toISOString(),
      size: file.getSize(),
    };
  }

  private blobToDataUrl(
    blob: GoogleAppsScript.Base.Blob,
    mime: string
  ): string {
    const base64 = Utilities.base64Encode(blob.getBytes());
    return `data:${mime};base64,${base64}`;
  }

  private replaceFileContent(
    file: GoogleAppsScript.Drive.File,
    blob: GoogleAppsScript.Base.Blob,
    driveDataId: string,
    fileName: string
  ) {
    // Replace the file content by setting content from blob. Use getDataAsString which may be appropriate for text;
    // For binary-safe replacement, delete and recreate the file in the same folder (preserve name format and parents).
    try {
      const parent = file.getParents().hasNext()
        ? file.getParents().next()
        : null;
      // Trash the old file and create a new one with same name (prefixed)
      file.setTrashed(true);
      if (parent) {
        const newFile = parent.createFile(blob);
        newFile.setName(`${driveDataId}_${fileName}`);
      } else {
        // fallback: replace content
        file.setContent(blob.getDataAsString());
        file.setName(`${driveDataId}_${fileName}`);
      }
    } catch (e) {
      // rethrow to caller
      throw e;
    }
  }
}
