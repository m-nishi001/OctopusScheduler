// --- 汎用DTO(旧 @octopus/core の Drive 系型。どのモジュールにも属さないため契約側に残す) ---

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
  /** 素材の表示名(拡張子つき)。一覧の表示と、種類の判定に使う。 */
  fileName?: string;
}

export interface OperationResult<T = void> {
  status: "success" | "duplicate" | "error";
  data?: T;
  message?: string;
}

export interface DriveJsonData {
  appFileId?: string;
  metadata?: DriveMetadata;
  fileName: string;
  jsonText: string;
  uploadDate: string;
  parentFolderId: string;
}
