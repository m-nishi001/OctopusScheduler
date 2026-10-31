import {
  StorageKind,
  StorageModule,
  storagePath,
} from "@octopus/infrastructures/compositions";
import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";

export interface AddJsonBlobDeps {
  storage: IKeyValueStorage;
}

/**
 * jackpotGame_addJson。クライアントが渡したテキスト(同期の `{ updatedAt, data }`)を、中身を見ずにそのまま保存する。
 * 更新日時はクライアントが刻んだものをテキストの中に持つため、サーバーの時刻は使わない。
 */
export async function addJsonBlob(
  deps: AddJsonBlobDeps,
  blob: { fileName: string; json: string }
): Promise<void> {
  const key = storagePath(StorageModule.Jackpot, StorageKind.Json, blob.fileName);
  await deps.storage.putText(key, blob.json, "application/json");
}
