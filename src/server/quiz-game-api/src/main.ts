import {
  DriveData,
  OperationResult,
  DriveMetadata,
  DriveJsonData,
} from "../../../common/src/drive-types";

import { GoogleFormService } from "../../../common/src/google-form-service";
import { SpreadsheetService } from "../../../common/src/google-spreadsheet-service";
import { GoogleDriveService } from "../../../common/src/google-drive-service";
import type {
  SheetRow,
  QuizWithDataUrl,
  ProcessedResultDto,
  StopFormArgs,
  GetSheetDataArgs,
  StopAndGetProcessedResultsArgs,
  LoadEmailNameMapArgs,
  GetMappedResponsesArgs,
  AddDriveDataArgs,
  GetDriveMetaDataArgs,
  GetDriveDataArgs,
  RemoveDriveDataArgs,
  UpdateDriveDataArgs,
  AddJsonArgs,
  GetJsonArgs,
  AddJsonDataArgs,
  GetJsonDataArgs,
  ListJsonMetaDataArgs,
  UpdateJsonDataArgs,
  TrashFolderContentsArgs,
} from "./quiz-game-api.d.ts";

// Instantiate services
const driveService = new GoogleDriveService();

// Hard-coded ScriptProperty keys (project-specific)
const JSON_FOLDER_PROPERTY = "quiz-game-json-folder";
const ASSET_FOLDER_PROPERTY = "quiz-game-asset-folder";

// Helper: resolve the asset folder id to use for uploads. Prefer provided folderId,
// otherwise fall back to ScriptProperties key defined above.
function getAssetFolderId(providedFolderId?: string): string {
  const folderId =
    providedFolderId ||
    PropertiesService.getScriptProperties().getProperty(
      ASSET_FOLDER_PROPERTY
    ) ||
    "";
  if (!folderId) {
    throw new Error(
      `ScriptProperties '${ASSET_FOLDER_PROPERTY}' is not configured and no parentFolderId was provided.`
    );
  }
  return folderId;
}

// Helper: resolve the json folder id to use for JSON files. Prefer provided folderId,
// otherwise fall back to JSON_FOLDER_PROPERTY.
function getJsonFolderId(providedFolderId?: string): string {
  const folderId =
    providedFolderId ||
    PropertiesService.getScriptProperties().getProperty(JSON_FOLDER_PROPERTY) ||
    "";
  if (!folderId) {
    throw new Error(
      `ScriptProperties '${JSON_FOLDER_PROPERTY}' is not configured and no parentFolderId was provided.`
    );
  }
  return folderId;
}

// Drive / JSON helper functions (similar to jackpot-game-api)
declare let _quizGame_addDriveData: (args: AddDriveDataArgs) => string;
declare let _quizGame_getDriveMetaData: (args: GetDriveMetaDataArgs) => string;
declare let _quizGame_getDriveData: (args: GetDriveDataArgs) => string;
declare let _quizGame_removeDriveData: (args: RemoveDriveDataArgs) => string;
declare let _quizGame_updateDriveData: (args: UpdateDriveDataArgs) => string;
declare let _quizGame_addJson: (args: AddJsonArgs) => string;
declare let _quizGame_getJson: (args: GetJsonArgs) => string;
declare let _quizGame_addJsonData: (args: AddJsonDataArgs) => string;
declare let _quizGame_getJsonData: (args: GetJsonDataArgs) => string;
declare let _quizGame_listJsonMetaData: (args: ListJsonMetaDataArgs) => string;
declare let _quizGame_updateJsonData: (args: UpdateJsonDataArgs) => string;

// Basic existing functions: stop form / get sheet data
declare let _quizGame_stopForm: (args: StopFormArgs) => string;
declare let _quizGame_getSheetData: (args: GetSheetDataArgs) => string;

// Email->Name mapping cache key and ScriptProperty key for spreadsheet id
const EMAIL_NAME_MAP_CACHE_KEY = "quiz-email-name-map";
const EMAIL_NAME_SPREADSHEET_PROPERTY = "email-name-spreadsheet-id";

// Declarations for new functions
declare let _quizGame_loadEmailNameMap: (args: LoadEmailNameMapArgs) => string;
declare let _quizGame_getMappedResponses: (
  args: GetMappedResponsesArgs
) => string;
declare let _quizGame_stopAndGetProcessedResults: (
  args: StopAndGetProcessedResultsArgs
) => string;

_quizGame_stopForm = (args: StopFormArgs): string => {
  const { quizId } = args;
  try {
    const form = FormApp.openById(quizId);
    form.setAcceptingResponses(false);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

_quizGame_getSheetData = (args: GetSheetDataArgs): string => {
  const { quizId } = args;
  try {
    const googleFormService = new GoogleFormService();
    const spreadsheetId = googleFormService.getDestinationSpreadsheetId(quizId);

    if (!spreadsheetId)
      throw new Error("No destination spreadsheet linked to the form");

    const spreadsheetService = new SpreadsheetService(spreadsheetId);
    const sheetNames = spreadsheetService.getAllSpreadsheetNames();

    if (sheetNames.length === 0)
      throw new Error("No sheets found in the spreadsheet");

    const sheetName = sheetNames[0]; // Use the first sheet
    const spreadsheetData = spreadsheetService.getSpreadsheetData(sheetName);

    if (!spreadsheetData) throw new Error("Failed to get spreadsheet data");

    const rows: SheetRow[] = spreadsheetData.data
      .slice(1)
      .map((row: string[]) => ({
        name: row[0],
        time: parseInt(row[1], 10),
      }));

    return JSON.stringify({ status: "success", data: rows });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

// Helper: load email->name map from spreadsheet (A: name, B: email) and cache it
function loadEmailNameMapImpl(): Record<string, string> {
  const propId = PropertiesService.getScriptProperties().getProperty(
    EMAIL_NAME_SPREADSHEET_PROPERTY
  );
  Logger.log(
    "[_quizGame] loadEmailNameMapImpl: EMAIL_NAME_SPREADSHEET_PROPERTY=%s",
    EMAIL_NAME_SPREADSHEET_PROPERTY
  );
  if (!propId || propId.trim() === "") {
    throw new Error(
      `ScriptProperty '${EMAIL_NAME_SPREADSHEET_PROPERTY}' is not set.`
    );
  }

  const ss = SpreadsheetApp.openById(propId);
  const sheets = ss.getSheets();
  if (!sheets || sheets.length === 0) {
    throw new Error("Email->Name spreadsheet has no sheets");
  }
  const sheet = sheets[0];
  const values = sheet.getDataRange().getValues();
  // Expect header in first row; data starts at 2
  const map: Record<string, string> = {};
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const nameCell = row[0];
    const emailCell = row[1];
    if (!emailCell) continue;
    const email = String(emailCell).toLowerCase().trim();
    if (!email) continue;
    map[email] = nameCell ? String(nameCell) : "";
  }

  try {
    const cache = CacheService.getScriptCache();
    cache.put(EMAIL_NAME_MAP_CACHE_KEY, JSON.stringify(map), 3600);
  } catch (e) {
    // Cache failure should not break functionality; continue returning map
    console.warn(
      "Failed to put email-name map into cache:",
      (e as Error).message
    );
  }

  Logger.log(
    "[_quizGame] loadEmailNameMapImpl: loaded map entries=%s",
    Object.keys(map).length
  );

  return map;
}

// Public: load email->name mapping into Script Cache
_quizGame_loadEmailNameMap = (args: LoadEmailNameMapArgs): string => {
  try {
    loadEmailNameMapImpl();
    Logger.log("[_quizGame] _quizGame_loadEmailNameMap: success");
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    Logger.log(
      "[_quizGame] _quizGame_loadEmailNameMap: failed %s",
      (error as Error).message
    );
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

// Public: get mapped responses from the Form-linked spreadsheet.
// Returns array of objects where keys are header strings and meta fields prefixed with __ are included.
_quizGame_getMappedResponses = (args: GetMappedResponsesArgs): string => {
  const { formId } = args;
  try {
    Logger.log(
      "[_quizGame] _quizGame_getMappedResponses called for formId=%s",
      formId
    );
    const googleFormService = new GoogleFormService();
    const spreadsheetId = googleFormService.getDestinationSpreadsheetId(formId);
    if (!spreadsheetId)
      throw new Error("No destination spreadsheet linked to the form");

    Logger.log(
      "[_quizGame] _quizGame_getMappedResponses: spreadsheetId=%s",
      spreadsheetId
    );

    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheets = ss.getSheets();
    if (!sheets || sheets.length === 0)
      throw new Error("No sheets found in the destination spreadsheet");
    const sheet = sheets[0];
    const values = sheet.getDataRange().getValues();
    Logger.log(
      "[_quizGame] _quizGame_getMappedResponses: rows=%s cols=%s",
      values ? values.length : 0,
      values && values[0] ? values[0].length : 0
    );
    if (!values || values.length < 2) {
      return JSON.stringify({ status: "success", data: [] });
    }

    const headers = values[0].map((h) =>
      h === null || h === undefined ? "" : String(h)
    );

    // detect timestamp and email column indices
    let timestampIndex = headers.findIndex((h) =>
      /タイムスタンプ|timestamp/i.test(h)
    );
    if (timestampIndex < 0) timestampIndex = 0;
    let emailIndex = headers.findIndex((h) => /メール|mail|email/i.test(h));
    if (emailIndex < 0) emailIndex = -1;

    // load cache or build map
    let mapJson = CacheService.getScriptCache().get(EMAIL_NAME_MAP_CACHE_KEY);
    let emailNameMap: Record<string, string> | null = null;
    if (mapJson) {
      try {
        emailNameMap = JSON.parse(mapJson);
      } catch {
        emailNameMap = null;
      }
    }
    if (!emailNameMap) {
      // attempt to load from spreadsheet property
      try {
        emailNameMap = loadEmailNameMapImpl();
      } catch (e) {
        emailNameMap = {};
      }
    }

    const out: any[] = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const obj: Record<string, any> = {};
      for (let j = 0; j < headers.length; j++) {
        const key = headers[j] || `col_${j}`;
        const v = row[j];
        obj[key] = v === undefined || v === null ? "" : String(v);
      }
      // meta
      obj.__rowIndex = i + 1; // sheet row index (1-based)
      obj.__raw = row;

      // timestamp
      const tsCell = row[timestampIndex];
      let tsMs: number | null = null;
      if (tsCell !== undefined && tsCell !== null && tsCell !== "") {
        const d = new Date(tsCell);
        const t = d.getTime();
        if (!Number.isNaN(t)) tsMs = t;
      }
      obj.__timestampMs = tsMs;

      // email -> name mapping
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

    Logger.log(
      "[_quizGame] _quizGame_getMappedResponses: returning %s mapped rows",
      out.length
    );

    return JSON.stringify({ status: "success", data: out });
  } catch (error) {
    Logger.log(
      "[_quizGame] _quizGame_getMappedResponses failed: %s",
      (error as Error).message
    );
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

// New function: stop form and get processed results (correct answers sorted by fastest)
_quizGame_stopAndGetProcessedResults = (
  args: StopAndGetProcessedResultsArgs
): string => {
  const { quizId, quizStartTimeMs, answerKey, correctValue } = args;
  try {
    Logger.log(
      "[_quizGame] _quizGame_stopAndGetProcessedResults called: quizId=%s, quizStartTimeMs=%s, answerKey=%s, correctValue=%s",
      quizId,
      quizStartTimeMs,
      answerKey,
      correctValue
    );
    // Step 1: Stop the form
    const form = FormApp.openById(quizId);
    form.setAcceptingResponses(false);
    Logger.log(
      "[_quizGame] _quizGame_stopAndGetProcessedResults: form stopped for quizId=%s",
      quizId
    );

    // Step 2: Get mapped responses (mappedResponse is JSON string)
    const mappedResponseRaw = _quizGame_getMappedResponses({ formId: quizId });
    let mappedResponseObj: any;
    try {
      mappedResponseObj = JSON.parse(mappedResponseRaw);
    } catch (_e) {
      throw new Error("Failed to parse mapped responses");
    }
    if (mappedResponseObj.status !== "success") {
      throw new Error("Failed to get mapped responses");
    }
    const answers = mappedResponseObj.data;
    Logger.log(
      "[_quizGame] _quizGame_stopAndGetProcessedResults: mapped responses count=%s",
      Array.isArray(answers) ? answers.length : 0
    );

    // Step 3: Filter correct answers and valid timestamps
    const filtered = answers.filter((r: any) => {
      const normVal = String(r[answerKey] || "").trim();
      if (normVal !== correctValue) return false;
      const t = r.__timestampMs;
      if (t === undefined || t === null || Number.isNaN(Number(t)))
        return false;
      return true;
    });

    // Step 4: Sort by timestamp ascending (fastest first)
    filtered.sort(
      (a: any, b: any) =>
        Number(a.__timestampMs ?? 0) - Number(b.__timestampMs ?? 0)
    );

    // Step 5: Build ProcessedResultDto array with rank
    const results: ProcessedResultDto[] = filtered.map(
      (r: any, index: number) => {
        const rawTs = Number(r.__timestampMs);
        const timestampMs = Number.isFinite(rawTs) ? rawTs : NaN;
        const timeToAnswerMs = Number.isFinite(timestampMs)
          ? timestampMs - quizStartTimeMs
          : NaN;
        return {
          playerId: null, // Not available
          playerName: r.name || null,
          isCorrect: true, // All filtered are correct
          timeToAnswerMs,
          timestampMs,
          rank: index + 1,
          rawRow: r.__raw,
        } as ProcessedResultDto;
      }
    );

    Logger.log(
      "[_quizGame] _quizGame_stopAndGetProcessedResults: processed results count=%s",
      results.length
    );

    return JSON.stringify({ status: "success", data: results });
  } catch (error) {
    Logger.log(
      "[_quizGame] _quizGame_stopAndGetProcessedResults failed: %s",
      (error as Error).message
    );
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

// Drive helper implementations
_quizGame_addDriveData = (args: AddDriveDataArgs): string => {
  const { driveData } = args;
  try {
    // Resolve parent folder id if not provided so clients can omit it.
    const parent = driveData.parentFolderId || getAssetFolderId();
    const payload: DriveData = { ...driveData, parentFolderId: parent };
    const result = driveService.addDriveData(payload);
    return JSON.stringify({ status: "success", data: result.data! });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

_quizGame_getDriveMetaData = (args: GetDriveMetaDataArgs): string => {
  const { folderId } = args;
  try {
    const resolved = folderId || getAssetFolderId();
    const result = driveService.getDriveMetaData(resolved);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

_quizGame_getDriveData = (args: GetDriveDataArgs): string => {
  const { dataId } = args;
  try {
    const result = driveService.getDriveData(dataId);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

_quizGame_removeDriveData = (args: RemoveDriveDataArgs): string => {
  const { dataId } = args;
  try {
    driveService.removeDriveData(dataId);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

_quizGame_updateDriveData = (args: UpdateDriveDataArgs): string => {
  const { driveData } = args;
  try {
    driveService.updateDriveData(driveData);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

// JSON file helpers
_quizGame_addJson = (args: AddJsonArgs): string => {
  const { driveJson } = args;
  try {
    const folderId = getJsonFolderId(driveJson.parentFolderId);

    const blob = Utilities.newBlob(
      driveJson.jsonText,
      "application/json",
      driveJson.fileName
    );
    const folder = DriveApp.getFolderById(folderId);

    const appFileId = driveJson.appFileId ?? "";
    const nameToSet = appFileId
      ? `${appFileId}_${driveJson.fileName}`
      : driveJson.fileName;

    const file = folder.createFile(blob);
    file.setName(nameToSet);
    const metadata: DriveMetadata = {
      driveDataId: file.getName().split("_")[0] || file.getId(),
      fileId: file.getId(),
      parentFolderId: folderId,
      lastUpdate: new Date(file.getLastUpdated().getTime()).toISOString(),
      size: file.getSize(),
    };
    return JSON.stringify({ status: "success", data: metadata });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

_quizGame_getJson = (args: GetJsonArgs): string => {
  const { fileId } = args;
  try {
    let folderId = "";
    try {
      folderId = getJsonFolderId();
    } catch (e) {
      console.warn("getJson: json folder id not configured or not provided", e);
      return JSON.stringify({
        status: "success",
        data: { json: JSON.stringify([]) },
      });
    }
    const folder = DriveApp.getFolderById(folderId);

    if (fileId && fileId.trim() !== "") {
      try {
        const file = DriveApp.getFileById(fileId);
        const content = file.getBlob().getDataAsString();
        return JSON.stringify({ status: "success", data: { json: content } });
      } catch (e) {
        const filesByPrefix = folder.getFiles();
        while (filesByPrefix.hasNext()) {
          const f = filesByPrefix.next();
          if (f.getName().startsWith(`${fileId}_`)) {
            const content = f.getBlob().getDataAsString();
            return JSON.stringify({
              status: "success",
              data: { json: content },
            });
          }
        }
      }
    }

    const files = folder.getFilesByName("quizzes.json");
    if (!files.hasNext()) {
      return JSON.stringify({
        status: "success",
        data: { json: JSON.stringify([]) },
      });
    }
    const file = files.next();
    const content = file.getBlob().getDataAsString();
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = [];
    }
    if (!Array.isArray(parsed)) parsed = [];
    return JSON.stringify({
      status: "success",
      data: { json: JSON.stringify(parsed) },
    });
  } catch (error) {
    console.error("_quizGame_getJson error:", (error as Error).message);
    return JSON.stringify({
      status: "success",
      data: { json: JSON.stringify([]) },
    });
  }
};

_quizGame_addJsonData = (args: AddJsonDataArgs): string => {
  const { driveJson } = args;
  try {
    return _quizGame_addJson({ driveJson });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

_quizGame_getJsonData = (args: GetJsonDataArgs): string => {
  const { fileId } = args;
  try {
    return _quizGame_getJson({ fileId });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

_quizGame_listJsonMetaData = (args: ListJsonMetaDataArgs): string => {
  const { folderId } = args;
  try {
    const resolved = folderId || getJsonFolderId();
    const result = driveService.getDriveMetaData(resolved);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

_quizGame_updateJsonData = (args: UpdateJsonDataArgs): string => {
  const { driveJson } = args;
  try {
    const fileId = driveJson.metadata?.fileId;
    if (!fileId) {
      return JSON.stringify({
        status: "error",
        message: "metadata.fileId is required for update",
      });
    }
    const file = DriveApp.getFileById(fileId);
    file.setContent(driveJson.jsonText);
    if (driveJson.fileName && driveJson.fileName !== file.getName()) {
      file.setName(driveJson.fileName);
    }
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

// NOTE: dataUrl <-> Blob conversion is handled by `GoogleDriveService` helpers
// (createBlobFromDataUrlOrBase64 / blobToDataUrl). The server-local copies
// were removed to avoid duplication.

// Main: unified bulk sync
// Trash all files in a folder (idempotent). Clients may call this to perform
// destructive cleanup before writing new JSON or assets.
declare let _quizGame_trashFolderContents: (
  args: TrashFolderContentsArgs
) => string;

_quizGame_trashFolderContents = (args: TrashFolderContentsArgs): string => {
  const { folderId } = args;
  try {
    if (!folderId || folderId.trim() === "") {
      return JSON.stringify({
        status: "error",
        message: "folderId is required",
      });
    }
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    while (files.hasNext()) {
      files.next().setTrashed(true);
    }
    // also remove files in subfolders recursively
    const subFolders = folder.getFolders();
    while (subFolders.hasNext()) {
      const sf = subFolders.next();
      const f2 = sf.getFiles();
      while (f2.hasNext()) f2.next().setTrashed(true);
    }
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};
