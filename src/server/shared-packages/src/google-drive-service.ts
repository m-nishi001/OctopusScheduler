interface DriveData {
  fileId: string;
  fileName: string;
  fileKind: string; // MimeType
  fileData: string; // dataUrl
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
    file.setName(driveData.fileName);
    // Note: Need to set parent folder if needed
  }

  getDriveMetaData(): DriveMetadata[] {
    const files = DriveApp.getFiles();
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
    try {
      const file = DriveApp.getFileById(dataId);
      file.setTrashed(true);
    } catch {
      // Ignore if file not found
    }
  }

  updateDriveData(driveData: DriveData): void {
    try {
      const file = DriveApp.getFileById(driveData.fileId);
      const blob = Utilities.newBlob(
        Utilities.base64Decode(driveData.fileData),
        driveData.fileKind,
        driveData.fileName
      );
      file.setContent(blob.getDataAsString());
      file.setName(driveData.fileName);
    } catch {
      // Ignore if file not found
    }
  }
}
