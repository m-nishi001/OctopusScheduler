import type {
  IFileStorageRepository,
  IKeyValueRepository,
} from "@octopus/infrastructures/interfaces";
import { resolveFolderIdPreferringProvided } from "@octopus/infrastructures/interfaces";

export interface GetJsonBlobDeps {
  fileStorage: IFileStorageRepository;
  kv: IKeyValueRepository;
}

const JSON_FOLDER_PROPERTY = "quiz-game-json-folder";
const DEFAULT_FILE_NAME = "quizzes.json";

/**
 * quizGame_getJson。既存挙動を保持: 設定不備・ファイル未存在・JSON解析失敗など
 * 想定される失敗のほぼ全てで、エラーにせず空配列で success を返す。
 */
export function getJsonBlob(
  deps: GetJsonBlobDeps,
  fileId?: string
): { json: string } {
  try {
    let folderId: string;
    try {
      folderId = resolveFolderIdPreferringProvided(
        { kv: deps.kv },
        JSON_FOLDER_PROPERTY
      );
    } catch {
      return { json: JSON.stringify([]) };
    }

    if (fileId && fileId.trim() !== "") {
      const direct = deps.fileStorage.getFileContentAsText(fileId);
      if (direct !== null) {
        return { json: direct };
      }
      const byPrefix = deps.fileStorage.findFileByNamePrefix(
        folderId,
        `${fileId}_`
      );
      if (byPrefix) {
        const content = deps.fileStorage.getFileContentAsText(byPrefix.fileId);
        if (content !== null) return { json: content };
      }
      // 見つからない場合は既定ファイルへフォールバックする(既存挙動)。
    }

    const defaultFile = deps.fileStorage.findFileByExactName(
      folderId,
      DEFAULT_FILE_NAME
    );
    if (!defaultFile) return { json: JSON.stringify([]) };

    const content = deps.fileStorage.getFileContentAsText(defaultFile.fileId);
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
