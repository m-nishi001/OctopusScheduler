import type { DriveData, OperationResult } from "./types";
import type { IKeyValueStorage } from "../interfaces/key-value-storage";
import type { ICache } from "../interfaces/cache";
import { beginUpdate, commitUpdate, abortUpdate } from "./dedupe-guard";
import { encodeLocalName, extractBase64FromDataUrl, makeKey, splitKey } from "./item-key-naming";

export interface UpdateItemUseCaseDeps {
  storage: IKeyValueStorage;
  cache: ICache;
}

export async function updateDriveData(
  deps: UpdateItemUseCaseDeps,
  driveData: DriveData
): Promise<OperationResult<void>> {
  const itemId = driveData.metadata.driveDataId;
  const guard = await beginUpdate({ cache: deps.cache }, itemId);
  if (!guard.proceed) return guard.result;

  try {
    const oldKey = driveData.metadata.fileId;
    const { namespace } = splitKey(oldKey);
    const newKey = makeKey(namespace, encodeLocalName(itemId, driveData.fileName));
    const contentBase64 = extractBase64FromDataUrl(driveData.fileDataUrl || "");

    // 旧キーと新キーが異なる(=表示名が変わった)場合は、まず旧キーを削除する。
    // 以前は Drive 側の trash-and-recreate がこれを暗黙に行っていた。
    if (newKey !== oldKey) {
      await deps.storage.delete(oldKey);
    }
    await deps.storage.putBinary(newKey, contentBase64, driveData.fileKind);

    await commitUpdate({ cache: deps.cache }, itemId);
    return { status: "success" };
  } catch (error) {
    await abortUpdate({ cache: deps.cache }, itemId);
    return { status: "error", message: (error as Error).message };
  }
}
