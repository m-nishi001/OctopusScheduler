import type { DriveData, OperationResult, IFileStorageRepository } from "../file-storage-repository";
import type { ICacheRepository } from "../cache-repository";
import { beginUpdate, commitUpdate, abortUpdate } from "./dedupe-guard";
import { encodeFileName, extractBase64FromDataUrl } from "./drive-file-naming";

export interface UpdateDriveDataUseCaseDeps {
  fileStorage: IFileStorageRepository;
  cache: ICacheRepository;
}

export function updateDriveData(
  deps: UpdateDriveDataUseCaseDeps,
  driveData: DriveData
): OperationResult<void> {
  const itemId = driveData.metadata.driveDataId;
  const guard = beginUpdate({ cache: deps.cache }, itemId);
  if (!guard.proceed) return guard.result;

  try {
    const contentBase64 = extractBase64FromDataUrl(driveData.fileDataUrl || "");
    const fileName = encodeFileName(itemId, driveData.fileName);
    deps.fileStorage.replaceFileContent({
      fileId: driveData.metadata.fileId,
      fileName,
      mimeType: driveData.fileKind,
      contentBase64,
    });
    commitUpdate({ cache: deps.cache }, itemId);
    return { status: "success" };
  } catch (error) {
    abortUpdate({ cache: deps.cache }, itemId);
    return { status: "error", message: (error as Error).message };
  }
}
