import type {
  ICache,
  IKeyValueStorage,
  DataBaseFactory,
} from "@octopus/infrastructures/interfaces";
import { EMAIL_NAME_MAP_CACHE_KEY, loadEmailNameMap } from "./load-email-name-map-use-case";

export interface GetMappedResponsesDeps {
  form: { getDestinationRecordStoreId(formId: string): string | null };
  dataBaseFactory: DataBaseFactory;
  cache: ICache;
  storage: IKeyValueStorage;
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

  const dataBase = deps.dataBaseFactory(spreadsheetId);
  const sheetNames = dataBase.listCollections();
  if (!sheetNames || sheetNames.length === 0) {
    throw new Error("No sheets found in the destination spreadsheet");
  }
  const collection = dataBase.getCollection(sheetNames[0]);
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
        storage: deps.storage,
        cache: deps.cache,
        dataBaseFactory: deps.dataBaseFactory,
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
