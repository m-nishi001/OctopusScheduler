import type { IKeyValueStorage } from "../interfaces/key-value-storage";
import type { DriveMetadata } from "./types";
import { toDriveMetadata } from "./item-key-naming";

export interface GetItemMetadataUseCaseDeps {
  storage: IKeyValueStorage;
}

export function getDriveMetadata(
  deps: GetItemMetadataUseCaseDeps,
  namespace: string
): DriveMetadata[] {
  return deps.storage.listByPrefix(`${namespace}/`).map((meta) => toDriveMetadata(meta));
}
