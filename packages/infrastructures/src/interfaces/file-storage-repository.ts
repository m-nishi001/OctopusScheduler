/**
 * ファイルストレージの抽象化(GASでは Drive、将来 Cloudflare では R2 等)。
 *
 * ここでは「フォルダにファイルを作る/読む/探す/消す」という素朴な操作のみを
 * 定義する。ファイル名にアプリ側の id を埋め込む(`${itemId}_${displayName}`)
 * ような命名規約は Drive 特有の回避策であり、この契約には持たせない。
 * それは呼び出し側(interfaces/use-cases/)の責務とする。
 */

export interface StoredFileMeta {
  fileId: string;
  fileName: string;
  parentFolderId: string;
  lastUpdate: string;
  createdDate: string;
  size?: number;
}

export interface StoredFileContent {
  meta: StoredFileMeta;
  mimeType: string;
  contentBase64: string;
}

export interface IFileStorageRepository {
  createFile(params: {
    folderId: string;
    fileName: string;
    mimeType: string;
    contentBase64: string;
  }): StoredFileMeta;

  getFileById(fileId: string): StoredFileContent | null;

  /** テキスト/JSONファイルの内容を文字列として取得する。 */
  getFileContentAsText(fileId: string): string | null;

  /** 指定フォルダ内で、ファイル名が `prefix` から始まる最初のファイルを探す。 */
  findFileByNamePrefix(folderId: string, prefix: string): StoredFileMeta | null;

  /** 指定フォルダ内で、ファイル名が完全一致する最初のファイルを探す。 */
  findFileByExactName(folderId: string, fileName: string): StoredFileMeta | null;

  /** 指定フォルダとそのサブフォルダを再帰的に走査してメタデータ一覧を返す。 */
  listFilesRecursive(folderId: string): StoredFileMeta[];

  replaceFileContent(params: {
    fileId: string;
    fileName: string;
    mimeType: string;
    contentBase64: string;
  }): void;

  /** ファイルを削除(GAS実装ではゴミ箱へ移動)し、削除前のメタデータを返す。存在しない場合は null。 */
  deleteFile(fileId: string): StoredFileMeta | null;
}

export const IFileStorageRepositoryToken = Symbol("IFileStorageRepository");

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
