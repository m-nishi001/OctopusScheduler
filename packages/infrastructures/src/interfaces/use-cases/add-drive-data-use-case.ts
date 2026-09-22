import type {
  IFileStorageRepository,
  DriveData,
  DriveMetadata,
  OperationResult,
} from "../file-storage-repository";
import type { ICacheRepository } from "../cache-repository";
import { beginSave, commitSave, abortSave } from "./dedupe-guard";
import { encodeFileName, extractBase64FromDataUrl, toDriveMetadata } from "./drive-file-naming";

export interface AddDriveDataUseCaseDeps {
  fileStorage: IFileStorageRepository;
  cache: ICacheRepository;
}

export function addDriveData(
  deps: AddDriveDataUseCaseDeps,
  driveData: DriveData
): OperationResult<DriveMetadata> {
  const itemId = driveData.metadata.driveDataId;
  const guard = beginSave({ cache: deps.cache }, itemId);
  if (!guard.proceed) return guard.result;

  try {
    const contentBase64 = extractBase64FromDataUrl(driveData.fileDataUrl || "");
    const fileName = encodeFileName(itemId, driveData.fileName);
    const meta = deps.fileStorage.createFile({
      folderId: driveData.parentFolderId,
      fileName,
      mimeType: driveData.fileKind,
      contentBase64,
    });
    commitSave({ cache: deps.cache }, itemId);
    return { status: "success", data: toDriveMetadata(meta, itemId) };
  } catch (error) {
    abortSave({ cache: deps.cache }, itemId);
    return { status: "error", message: (error as Error).message };
  }
}
