import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import {
  StorageKind,
  StorageModule,
  storageNamespace,
  storagePath,
} from "@octopus/infrastructures/compositions";

export interface GetJsonBlobDeps {
  storage: IKeyValueStorage;
}

const JSON_NAMESPACE = storageNamespace(StorageModule.Quiz, StorageKind.Json);
const DEFAULT_FILE_NAME = "quizzes.json";

/**
 * quizGame_getJson。ファイルが無い・中身が配列でない・JSON として読めないときは、
 * 空配列を返す(初回起動や壊れたファイルでも画面が動くように)。読み取りの失敗(通信エラーなど)は
 * 空配列にせず例外で伝える(空を「リモートの内容」と受け取った側が、実データを上書きしてしまうため)。
 *
 * updatedAt: バックグラウンド同期のLast-Write-Winsに使うため、実際に内容を
 * 読み取ったキーのメタデータ(updatedAt)も併せて返す。
 */
export async function getJsonBlob(
  deps: GetJsonBlobDeps,
  fileId?: string
): Promise<{ json: string; updatedAt: string | null }> {
  if (fileId && fileId.trim() !== "") {
    const direct = await deps.storage.getContentAsText(fileId);
    if (direct !== null) {
      const meta = await deps.storage.stat(fileId);
      return { json: direct, updatedAt: meta?.updatedAt ?? null };
    }
    const byPrefix = (await deps.storage.listByPrefix(`${JSON_NAMESPACE}/${fileId}_`))[0];
    if (byPrefix) {
      const content = await deps.storage.getContentAsText(byPrefix.key);
      if (content !== null) {
        return { json: content, updatedAt: byPrefix.updatedAt };
      }
    }
    // 見つからない場合は既定ファイルへフォールバックする(既存挙動)。
  }

  const defaultFile = await deps.storage.stat(storagePath(StorageModule.Quiz, StorageKind.Json, DEFAULT_FILE_NAME));
  if (!defaultFile) return { json: JSON.stringify([]), updatedAt: null };

  const content = await deps.storage.getContentAsText(defaultFile.key);
  if (content === null) return { json: JSON.stringify([]), updatedAt: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = [];
  }
  if (!Array.isArray(parsed)) parsed = [];
  return { json: JSON.stringify(parsed), updatedAt: defaultFile.updatedAt };
}
