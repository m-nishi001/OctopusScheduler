interface DriveData {
  metadata: DriveMetadata;
  fileName: string;
  fileKind: string; // MimeType
  fileDataUrl: string; // dataUrl
  uploadDate: Date;
  parentFolderId: string;
}

interface DriveMetadata {
  driveDataId: string;
  fileId: string;
  parentFolderId: string;
  lastUpdate: Date;
}

export class GoogleDriveService {
  addDriveData(driveData: DriveData): DriveMetadata {
    const blob = Utilities.newBlob(
      Utilities.base64Decode(driveData.fileDataUrl),
      driveData.fileKind,
      driveData.fileName
    );
    const folder = DriveApp.getFolderById(driveData.parentFolderId);
    const file = folder.createFile(blob);
    file.setName(`${driveData.metadata.driveDataId}_${driveData.fileName}`);
    return {
      driveDataId: driveData.metadata.driveDataId,
      fileId: file.getId(),
      parentFolderId: file.getParents().next().getId(),
      lastUpdate: new Date(file.getLastUpdated().getTime()),
    };
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
      file.setTrashed(true);
    } catch {
      // Ignore if file not found
    }
  }

  updateDriveData(driveData: DriveData): void {
    try {
      const file = DriveApp.getFileById(driveData.metadata.fileId);
      const blob = Utilities.newBlob(
        Utilities.base64Decode(driveData.fileDataUrl),
        driveData.fileKind,
        driveData.fileName
      );
      file.setContent(blob.getDataAsString());
      file.setName(`${driveData.metadata.driveDataId}_${driveData.fileName}`);
    } catch {
      // Ignore if file not found
    }
  }
}
