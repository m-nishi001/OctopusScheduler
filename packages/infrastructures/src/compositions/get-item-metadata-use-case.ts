import type { IKeyValueStorage } from "../interfaces/key-value-storage";
import type { DriveMetadata } from "./types";
import { toDriveMetadata } from "./item-key-naming";

export interface GetItemMetadataUseCaseDeps {
  storage: IKeyValueStorage;
}

export async function getDriveMetadata(
  deps: GetItemMetadataUseCaseDeps,
  namespace: string
): Promise<DriveMetadata[]> {
  const items = await deps.storage.listByPrefix(`${namespace}/`);
  return items.map((meta) => toDriveMetadata(meta));
}
