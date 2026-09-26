import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import { resolveFolderIdPreferringProvided } from "@octopus/infrastructures/compositions";

export interface GetJsonBlobDeps {
  storage: IKeyValueStorage;
}

const JSON_FOLDER_PROPERTY = "jackpot-game-json-folder";
const DEFAULT_FILE_NAME = "prizes.json";

/**
 * jackpotGame_getJson。既存挙動を保持: 設定不備・ファイル未存在・JSON解析失敗など
 * 想定される失敗のほぼ全てで、エラーにせず空配列で success を返す。
 */
export async function getJsonBlob(
  deps: GetJsonBlobDeps,
  fileId?: string
): Promise<{ json: string }> {
  try {
    let namespace: string;
    try {
      namespace = await resolveFolderIdPreferringProvided(
        { kv: deps.storage },
        JSON_FOLDER_PROPERTY
      );
    } catch {
      return { json: JSON.stringify([]) };
    }

    if (fileId && fileId.trim() !== "") {
      const direct = await deps.storage.getContentAsText(fileId);
      if (direct !== null) {
        return { json: direct };
      }
      const byPrefix = (await deps.storage.listByPrefix(`${namespace}/${fileId}_`))[0];
      if (byPrefix) {
        const content = await deps.storage.getContentAsText(byPrefix.key);
        if (content !== null) return { json: content };
      }
      // 見つからない場合は既定ファイルへフォールバックする(既存挙動)。
    }

    const defaultFile = await deps.storage.stat(`${namespace}/${DEFAULT_FILE_NAME}`);
    if (!defaultFile) return { json: JSON.stringify([]) };

    const content = await deps.storage.getContentAsText(defaultFile.key);
    if (content === null) return { json: JSON.stringify([]) };

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = [];
    }
    if (!Array.isArray(parsed)) parsed = [];
    return { json: JSON.stringify(parsed) };
  } catch {
    return { json: JSON.stringify([]) };
  }
}
