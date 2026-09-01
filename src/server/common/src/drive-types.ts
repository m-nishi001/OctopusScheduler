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
  // App-managed file id is application-scoped identity used by the client.
  // This is not part of the Drive metadata — GAS will initialize Drive
  // metadata (driveDataId, fileId, etc.) server-side. The client may
  // supply an `appFileId` for application-level purposes which GAS will
  // use as the filename prefix but it's not part of Drive metadata.
  appFileId?: string;

  // Drive metadata is optional on input; server initializes it and returns
  // fully-populated metadata in responses. Avoid sending client-managed
  // data inside metadata.
  metadata?: DriveMetadata;
  fileName: string;
  jsonText: string;
  uploadDate: string;
  parentFolderId: string;
}
