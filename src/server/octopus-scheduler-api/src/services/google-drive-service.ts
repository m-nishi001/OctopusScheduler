interface DriveData {
  fileId: string;
  fileName: string;
  fileKind: string;
  fileData: string;
  uploadDate: Date;
  lastUpdate: Date;
}

interface DriveMetadata {
  fileId: string;
  lastUpdate: Date;
}

export class GoogleDriveService {
  addDriveData(driveData: DriveData): void {
    const blob = Utilities.newBlob(
      Utilities.base64Decode(driveData.fileData),
      driveData.fileKind,
      driveData.fileName
    );
    const file = DriveApp.createFile(blob);
    // Note: fileId is not returned, but can be retrieved if needed
  }

  getDriveMetaData(): DriveMetadata[] {
    // Assuming files are in a specific folder, get metadata
    const folder = DriveApp.getFolderById("some-folder-id"); // Replace with actual folder ID
    const files = folder.getFiles();
    const metadata: DriveMetadata[] = [];
    while (files.hasNext()) {
      const file = files.next();
      metadata.push({
        fileId: file.getId(),
        lastUpdate: new Date(file.getLastUpdated().getTime()),
      });
    }
    return metadata;
  }

  getDriveData(dataId: string): DriveData | null {
    try {
      const file = DriveApp.getFileById(dataId);
      const blob = file.getBlob();
      const dataUrl = Utilities.base64Encode(blob.getBytes());
      return {
        fileId: dataId,
        fileName: file.getName(),
        fileKind: file.getMimeType(),
        fileData: dataUrl,
        uploadDate: new Date(file.getDateCreated().getTime()),
        lastUpdate: new Date(file.getLastUpdated().getTime()),
      };
    } catch {
      return null;
    }
  }

  removeDriveData(dataId: string): void {
    const file = DriveApp.getFileById(dataId);
    file.setTrashed(true);
  }

  updateDriveData(driveData: DriveData): void {
    const file = DriveApp.getFileById(driveData.fileId);
    const blob = Utilities.newBlob(
      Utilities.base64Decode(driveData.fileData),
      driveData.fileKind,
      driveData.fileName
    );
    file.setContent(blob.getDataAsString());
    file.setName(driveData.fileName);
  }
}
