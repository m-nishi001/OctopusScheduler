export interface DriveData {
  metadata: DriveMetadata;
  fileName: string;
  fileKind: string; // MimeType
  fileDataUrl: string; // dataUrl
  uploadDate: string;
  parentFolderId: string;
}

export interface DriveMetadata {
  driveDataId: string;
  fileId: string;
  parentFolderId: string;
  lastUpdate: string;
  size?: number;
}

export interface OperationResult<T = void> {
  status: "success" | "duplicate" | "error";
  data?: T;
  message?: string;
}

export interface DriveJsonData {
  metadata: DriveMetadata;
  fileName: string;
  jsonText: string;
  uploadDate: string;
  parentFolderId: string;
}
