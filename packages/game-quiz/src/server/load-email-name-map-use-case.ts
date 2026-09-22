import type {
  ICacheRepository,
  IKeyValueRepository,
  RecordStoreRepositoryFactory,
} from "@octopus/infrastructures/interfaces";

export const EMAIL_NAME_MAP_CACHE_KEY = "quiz-email-name-map";
export const EMAIL_NAME_SPREADSHEET_PROPERTY = "email-name-spreadsheet-id";
const EMAIL_NAME_MAP_TTL_SECONDS = 3600;

export interface LoadEmailNameMapDeps {
  kv: IKeyValueRepository;
  cache: ICacheRepository;
  recordStoreFactory: RecordStoreRepositoryFactory;
}

/**
 * 回答先スプレッドシートの email->name マッピング(A列:name, B列:email)を読み込み、
 * キャッシュに書き込む。キャッシュ書き込み失敗は無視して継続する(既存挙動)。
 */
export function loadEmailNameMap(
  deps: LoadEmailNameMapDeps
): Record<string, string> {
  const propId = deps.kv.get(EMAIL_NAME_SPREADSHEET_PROPERTY);
  if (!propId || propId.trim() === "") {
    throw new Error(
      `ScriptProperty '${EMAIL_NAME_SPREADSHEET_PROPERTY}' is not set.`
    );
  }

  const recordStore = deps.recordStoreFactory(propId);
  const sheetNames = recordStore.listCollections();
  if (!sheetNames || sheetNames.length === 0) {
    throw new Error("Email->Name spreadsheet has no sheets");
  }
  const collection = recordStore.getCollection(sheetNames[0]);
  const values = collection?.rows ?? [];

  const map: Record<string, string> = {};
  for (let i = 1; i < values.length; i++) {
    const row = values[i] as unknown[];
    const nameCell = row[0];
    const emailCell = row[1];
    if (!emailCell) continue;
    const email = String(emailCell).toLowerCase().trim();
    if (!email) continue;
    map[email] = nameCell ? String(nameCell) : "";
  }

  try {
    deps.cache.put(
      EMAIL_NAME_MAP_CACHE_KEY,
      JSON.stringify(map),
      EMAIL_NAME_MAP_TTL_SECONDS
    );
  } catch (e) {
    console.warn(
      "Failed to put email-name map into cache:",
      (e as Error).message
    );
  }

  return map;
}
