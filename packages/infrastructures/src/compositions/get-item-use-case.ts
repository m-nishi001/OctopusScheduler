import type { IKeyValueStorage } from "../interfaces/key-value-storage";
import type { DriveData } from "./types";
import {
  decodeDisplayName,
  decodeItemId,
  splitKey,
  toDataUrl,
  toDriveMetadata,
} from "./item-key-naming";

export interface GetItemUseCaseDeps {
  storage: IKeyValueStorage;
}

export async function getDriveData(
  deps: GetItemUseCaseDeps,
  storageRef: string
): Promise<DriveData | null> {
  try {
    const content = await deps.storage.getContent(storageRef);
    if (!content) return null;

    const { namespace, localName } = splitKey(content.meta.key);
    const itemId = decodeItemId(localName);
    const displayName = decodeDisplayName(localName);
    const dataUrl = toDataUrl(
      content.meta.mimeType || "application/octet-stream",
      content.contentBase64
    );

    return {
      metadata: toDriveMetadata(content.meta, itemId),
      fileName: displayName,
      fileKind: content.meta.mimeType,
      fileDataUrl: dataUrl,
      uploadDate: content.meta.createdAt,
      parentFolderId: namespace,
    };
  } catch {
    return null;
  }
}
