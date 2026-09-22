import type {
  ICacheRepository,
  IFormRepository,
  IKeyValueRepository,
  RecordStoreRepositoryFactory,
} from "@octopus/infrastructures/interfaces";
import { EMAIL_NAME_MAP_CACHE_KEY, loadEmailNameMap } from "./load-email-name-map-use-case";

export interface GetMappedResponsesDeps {
  form: IFormRepository;
  recordStoreFactory: RecordStoreRepositoryFactory;
  cache: ICacheRepository;
  kv: IKeyValueRepository;
}

/**
 * quizGame_getMappedResponses。タイムスタンプ/メール列をヘッダー名から推測し、
 * email->name マッピング(キャッシュ優先、無ければ再読込)を各行に合成する。
 * ヘッダー検出の正規表現・フォールバック・合成フィールド名はすべて既存挙動を保持する。
 */
export function getMappedResponses(
  deps: GetMappedResponsesDeps,
  formId: string
): Record<string, unknown>[] {
  const spreadsheetId = deps.form.getDestinationRecordStoreId(formId);
  if (!spreadsheetId) {
    throw new Error("No destination spreadsheet linked to the form");
  }

  const recordStore = deps.recordStoreFactory(spreadsheetId);
  const sheetNames = recordStore.listCollections();
  if (!sheetNames || sheetNames.length === 0) {
    throw new Error("No sheets found in the destination spreadsheet");
  }
  const collection = recordStore.getCollection(sheetNames[0]);
  const values = (collection?.rows ?? []) as unknown[][];
  if (!values || values.length < 2) return [];

  const headers = values[0].map((h) =>
    h === null || h === undefined ? "" : String(h)
  );

  let timestampIndex = headers.findIndex((h) => /タイムスタンプ|timestamp/i.test(h));
  if (timestampIndex < 0) timestampIndex = 0;
  let emailIndex = headers.findIndex((h) => /メール|mail|email/i.test(h));
  if (emailIndex < 0) emailIndex = -1;

  let emailNameMap: Record<string, string> | null = null;
  const mapJson = deps.cache.get(EMAIL_NAME_MAP_CACHE_KEY);
  if (mapJson) {
    try {
      emailNameMap = JSON.parse(mapJson);
    } catch {
      emailNameMap = null;
    }
  }
  if (!emailNameMap) {
    try {
      emailNameMap = loadEmailNameMap({
        kv: deps.kv,
        cache: deps.cache,
        recordStoreFactory: deps.recordStoreFactory,
      });
    } catch {
      emailNameMap = {};
    }
  }

  const out: Record<string, unknown>[] = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j] || `col_${j}`;
      const v = row[j];
      obj[key] = v === undefined || v === null ? "" : String(v);
    }
    obj.__rowIndex = i + 1;
    obj.__raw = row;

    const tsCell = row[timestampIndex];
    let tsMs: number | null = null;
    if (tsCell !== undefined && tsCell !== null && tsCell !== "") {
      const d = new Date(tsCell as string | number | Date);
      const t = d.getTime();
      if (!Number.isNaN(t)) tsMs = t;
    }
    obj.__timestampMs = tsMs;

    let normalizedEmail: string | null = null;
    if (emailIndex >= 0) {
      const emailCell = row[emailIndex];
      if (
        emailCell !== undefined &&
        emailCell !== null &&
        String(emailCell).trim() !== ""
      ) {
        normalizedEmail = String(emailCell).toLowerCase().trim();
      }
    }
    if (normalizedEmail && emailNameMap && emailNameMap[normalizedEmail]) {
      obj.name = emailNameMap[normalizedEmail];
    } else {
      obj.name = null;
    }

    out.push(obj);
  }

  return out;
}
