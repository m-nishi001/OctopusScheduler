import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import {
  StorageKind,
  StorageModule,
  storagePath,
} from "@octopus/infrastructures/compositions";

export interface GetJsonBlobDeps {
  storage: IKeyValueStorage;
}

/**
 * jackpotGame_getJson。保存してあるテキストを、中身を見ずにそのまま返す。まだ保存されていなければ json は null。
 * 読み取りの失敗(通信エラーなど)は null にせず例外で伝える(空を「リモートの内容」と受け取った側が、実データを上書きしてしまうため)。
 */
export async function getJsonBlob(
  deps: GetJsonBlobDeps,
  fileName: string
): Promise<{ json: string | null }> {
  const key = storagePath(StorageModule.Jackpot, StorageKind.Json, fileName);
  return { json: await deps.storage.getContentAsText(key) };
}
