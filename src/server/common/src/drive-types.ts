export interface DriveData {
  metadata: DriveMetadata;
  fileName: string;
  fileKind: string; // MimeType
  fileDataUrl: string; // dataUrl
  uploadDate: Date;
  parentFolderId: string;
}

export interface DriveMetadata {
  driveDataId: string;
  fileId: string;
  parentFolderId: string;
  lastUpdate: Date;
}

export interface OperationResult<T = void> {
  status: "success" | "duplicate" | "error";
  data?: T;
  message?: string;
}

/**
 * GAS関数呼び出しのレスポンス。
 */
export type GasResponse<T> =
  | {
      status: "success";
      data: T;
    }
  | {
      status: "error";
      message: string;
    };
