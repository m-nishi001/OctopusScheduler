import {
  DriveData,
  OperationResult,
  DriveMetadata,
  DriveJsonData,
} from "../../../common/src/drive-types";
import { GasResponse } from "../../../common/src/gas-types";
import { GoogleFormService } from "../../../common/src/google-form-service";
import { SpreadsheetService } from "../../../common/src/google-spreadsheet-service";
import { GoogleDriveService } from "../../../common/src/google-drive-service";
import type {
  SheetRow,
  QuizWithDataUrl,
  SyncRequest,
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
declare let _quizGame_addDriveData: (
  driveData: DriveData
) => GasResponse<DriveMetadata>;
declare let _quizGame_getDriveMetaData: (
  folderId?: string
) => GasResponse<DriveMetadata[]>;
declare let _quizGame_getDriveData: (
  dataId: string
) => GasResponse<DriveData | null>;
declare let _quizGame_removeDriveData: (dataId: string) => GasResponse<void>;
declare let _quizGame_updateDriveData: (
  driveData: DriveData
) => GasResponse<void>;
declare let _quizGame_addJson: (
  driveJson: DriveJsonData
) => GasResponse<DriveMetadata>;
declare let _quizGame_getJson: (
  fileId?: string
) => GasResponse<{ json: string }>;
declare let _quizGame_addJsonData: (
  driveJson: DriveJsonData
) => GasResponse<DriveMetadata>;
declare let _quizGame_getJsonData: (
  fileId?: string
) => GasResponse<{ json: string }>;
declare let _quizGame_listJsonMetaData: (
  folderId?: string
) => GasResponse<DriveMetadata[]>;
declare let _quizGame_updateJsonData: (
  driveJson: DriveJsonData
) => GasResponse<void>;

// Basic existing functions: stop form / get sheet data
declare let _quizGame_stopForm: (quizId: string) => GasResponse<void>;
declare let _quizGame_getSheetData: (quizId: string) => GasResponse<SheetRow[]>;

// Email->Name mapping cache key and ScriptProperty key for spreadsheet id
const EMAIL_NAME_MAP_CACHE_KEY = 'QUIZ_EMAIL_NAME_MAP';
const EMAIL_NAME_SPREADSHEET_PROPERTY = 'EMAIL_NAME_SPREADSHEET_ID';

// Declarations for new functions
declare let _quizGame_loadEmailNameMap: () => GasResponse<void>;
declare let _quizGame_getMappedResponses: (
  formId: string
) => GasResponse<any[]>;

_quizGame_stopForm = (quizId: string): GasResponse<void> => {
  try {
    const form = FormApp.openById(quizId);
    form.setAcceptingResponses(false);
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_quizGame_getSheetData = (quizId: string): GasResponse<SheetRow[]> => {
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

    return { status: "success", data: rows };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

// Drive helper implementations
_quizGame_addDriveData = (driveData: DriveData): GasResponse<DriveMetadata> => {
  try {
    // Resolve parent folder id if not provided so clients can omit it.
    const parent = driveData.parentFolderId || getAssetFolderId();
    const payload: DriveData = { ...driveData, parentFolderId: parent };
    const result = driveService.addDriveData(payload);
    return { status: "success", data: result.data! };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_quizGame_getDriveMetaData = (
  folderId?: string
): GasResponse<DriveMetadata[]> => {
  try {
    const resolved = folderId || getAssetFolderId();
    const result = driveService.getDriveMetaData(resolved);
    return { status: "success", data: result };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_quizGame_getDriveData = (dataId: string): GasResponse<DriveData | null> => {
  try {
    const result = driveService.getDriveData(dataId);
    return { status: "success", data: result };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_quizGame_removeDriveData = (dataId: string): GasResponse<void> => {
  try {
    driveService.removeDriveData(dataId);
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_quizGame_updateDriveData = (driveData: DriveData): GasResponse<void> => {
  try {
    driveService.updateDriveData(driveData);
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

// JSON file helpers
_quizGame_addJson = (driveJson: DriveJsonData): GasResponse<DriveMetadata> => {
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
    return { status: "success", data: metadata };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_quizGame_getJson = (fileId?: string): GasResponse<{ json: string }> => {
  try {
    let folderId = "";
    try {
      folderId = getJsonFolderId();
    } catch (e) {
      console.warn("getJson: json folder id not configured or not provided", e);
      return { status: "success", data: { json: JSON.stringify([]) } };
    }
    const folder = DriveApp.getFolderById(folderId);

    if (fileId && fileId.trim() !== "") {
      try {
        const file = DriveApp.getFileById(fileId);
        const content = file.getBlob().getDataAsString();
        return { status: "success", data: { json: content } };
      } catch (e) {
        const filesByPrefix = folder.getFiles();
        while (filesByPrefix.hasNext()) {
          const f = filesByPrefix.next();
          if (f.getName().startsWith(`${fileId}_`)) {
            const content = f.getBlob().getDataAsString();
            return { status: "success", data: { json: content } };
          }
        }
      }
    }

    const files = folder.getFilesByName("quizzes.json");
    if (!files.hasNext()) {
      return { status: "success", data: { json: JSON.stringify([]) } };
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
    return { status: "success", data: { json: JSON.stringify(parsed) } };
  } catch (error) {
    console.error("_quizGame_getJson error:", (error as Error).message);
    return { status: "success", data: { json: JSON.stringify([]) } };
  }
};

_quizGame_addJsonData = (
  driveJson: DriveJsonData
): GasResponse<DriveMetadata> => {
  try {
    return _quizGame_addJson(driveJson);
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_quizGame_getJsonData = (fileId?: string): GasResponse<{ json: string }> => {
  try {
    return _quizGame_getJson(fileId);
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_quizGame_listJsonMetaData = (
  folderId?: string
): GasResponse<DriveMetadata[]> => {
  try {
    const resolved = folderId || getJsonFolderId();
    const result = driveService.getDriveMetaData(resolved);
    return { status: "success", data: result };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_quizGame_updateJsonData = (driveJson: DriveJsonData): GasResponse<void> => {
  try {
    const fileId = driveJson.metadata?.fileId;
    if (!fileId) {
      return {
        status: "error",
        message: "metadata.fileId is required for update",
      };
    }
    const file = DriveApp.getFileById(fileId);
    file.setContent(driveJson.jsonText);
    if (driveJson.fileName && driveJson.fileName !== file.getName()) {
      file.setName(driveJson.fileName);
    }
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

// NOTE: dataUrl <-> Blob conversion is handled by `GoogleDriveService` helpers
// (createBlobFromDataUrlOrBase64 / blobToDataUrl). The server-local copies
// were removed to avoid duplication.

// Main: unified bulk sync
// Trash all files in a folder (idempotent). Clients may call this to perform
// destructive cleanup before writing new JSON or assets.
declare let _quizGame_trashFolderContents: (
  folderId?: string
) => GasResponse<void>;

_quizGame_trashFolderContents = (folderId?: string): GasResponse<void> => {
  try {
    if (!folderId || folderId.trim() === "") {
      return { status: "error", message: "folderId is required" };
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
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};
