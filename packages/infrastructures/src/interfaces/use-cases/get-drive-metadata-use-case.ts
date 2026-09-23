import type { IFileStorageRepository, DriveMetadata } from "../file-storage-repository";
import { toDriveMetadata } from "./drive-file-naming";

export interface GetDriveMetadataUseCaseDeps {
  fileStorage: IFileStorageRepository;
}

export function getDriveMetadata(
  deps: GetDriveMetadataUseCaseDeps,
  folderId: string
): DriveMetadata[] {
  return deps.fileStorage
    .listFilesRecursive(folderId)
    .map((meta) => toDriveMetadata(meta));
}
