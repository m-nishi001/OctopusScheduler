import {
  StorageNotConfiguredError,
  type IKeyValueStorage,
} from "@octopus/infrastructures/interfaces";
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
 * quizGame_getJson。既存挙動を保持: ファイル未存在・JSON解析失敗など
 * 想定される失敗のほぼ全てで、エラーにせず空配列で success を返す。
 *
 * updatedAt: バックグラウンド同期のLast-Write-Winsに使うため、実際に内容を
 * 読み取ったキーのメタデータ(updatedAt)も併せて返す。
 */
export async function getJsonBlob(
  deps: GetJsonBlobDeps,
  fileId?: string
): Promise<{ json: string; updatedAt: string | null }> {
  try {
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
  } catch (error) {
    // 保存先ルート未設定は設定不備として呼び出し元へ通知する。
    if (error instanceof StorageNotConfiguredError) throw error;
    return { json: JSON.stringify([]), updatedAt: null };
  }
}
