import type { DriveData, DriveMetadata, OperationResult } from "./types";
import type { IKeyValueStorage } from "../interfaces/key-value-storage";
import type { ICache } from "../interfaces/cache";
import { beginSave, commitSave, abortSave } from "./dedupe-guard";
import { encodeLocalName, extractBase64FromDataUrl, makeKey, toDriveMetadata } from "./item-key-naming";

export interface AddItemUseCaseDeps {
  storage: IKeyValueStorage;
  cache: ICache;
}

export async function addDriveData(
  deps: AddItemUseCaseDeps,
  driveData: DriveData
): Promise<OperationResult<DriveMetadata>> {
  const itemId = driveData.metadata.driveDataId;
  const guard = await beginSave({ cache: deps.cache }, itemId);
  if (!guard.proceed) return guard.result;

  try {
    const contentBase64 = extractBase64FromDataUrl(driveData.fileDataUrl || "");
    const key = makeKey(driveData.parentFolderId, encodeLocalName(itemId, driveData.fileName));
    const meta = await deps.storage.putBinary(key, contentBase64, driveData.fileKind);
    await commitSave({ cache: deps.cache }, itemId);
    return { status: "success", data: toDriveMetadata(meta, itemId) };
  } catch (error) {
    await abortSave({ cache: deps.cache }, itemId);
    return { status: "error", message: (error as Error).message };
  }
}
