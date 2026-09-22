import type { IFileStorageRepository, DriveData } from "../file-storage-repository";
import { decodeDisplayName, decodeItemId, toDataUrl, toDriveMetadata } from "./drive-file-naming";

export interface GetDriveDataUseCaseDeps {
  fileStorage: IFileStorageRepository;
}

export function getDriveData(
  deps: GetDriveDataUseCaseDeps,
  storageRef: string
): DriveData | null {
  try {
    const file = deps.fileStorage.getFileById(storageRef);
    if (!file) return null;

    const itemId = decodeItemId(file.meta.fileName);
    const displayName = decodeDisplayName(file.meta.fileName);
    const dataUrl = toDataUrl(
      file.mimeType || "application/octet-stream",
      file.contentBase64
    );

    return {
      metadata: toDriveMetadata(file.meta, itemId),
      fileName: displayName,
      fileKind: file.mimeType,
      fileDataUrl: dataUrl,
      uploadDate: file.meta.createdDate,
      parentFolderId: file.meta.parentFolderId,
    };
  } catch {
    return null;
  }
}
