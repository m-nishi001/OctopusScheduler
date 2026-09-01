import {
  DriveData,
  DriveMetadata,
  DriveJsonData,
} from "../../common/src/drive-types";
// Responses returned as JSON strings for client-side parsing
import { GoogleDriveService } from "../../common/src/google-drive-service";

declare let _octopusScheduler_doGet: (
  e: GoogleAppsScript.Events.DoGet
) => GoogleAppsScript.HTML.HtmlOutput;

declare let _octopusScheduler_addDriveData: (driveData: DriveData) => string;
declare let _octopusScheduler_getDriveMetaData: (folderId?: string) => string;
declare let _octopusScheduler_getDriveData: (dataId: string) => string;
declare let _octopusScheduler_removeDriveData: (dataId: string) => string;
declare let _octopusScheduler_updateDriveData: (driveData: DriveData) => string;
declare let _octopusScheduler_addJsonData: (driveJson: DriveJsonData) => string;
declare let _octopusScheduler_getJsonData: (fileId?: string) => string;
declare let _octopusScheduler_listJsonMetaData: (folderId?: string) => string;
declare let _octopusScheduler_updateJsonData: (
  driveJson: DriveJsonData
) => string;
declare let _octopusScheduler_getKeyboardShortcuts: () => string;
declare let _octopusScheduler_setKeyboardShortcuts: (payload: {
  shortcuts: string[][];
  config: any;
}) => string;

// Instantiate services
const driveService = new GoogleDriveService();

// Hard-coded ScriptProperty keys for folder configuration
const JSON_FOLDER_PROPERTY = "octopus-scheduler-json-folder";
const ASSET_FOLDER_PROPERTY = "octopus-scheduler-asset-folder";

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

// Resolve asset folder id from ScriptProperties. We intentionally ignore any
// client-provided folder id and always use the configured asset folder.
function getAssetFolderId(_providedFolderId?: string): string {
  const folderId =
    PropertiesService.getScriptProperties().getProperty(
      ASSET_FOLDER_PROPERTY
    ) || "";
  if (!folderId) {
    throw new Error(
      `ScriptProperties '${ASSET_FOLDER_PROPERTY}' is not configured and no parentFolderId was provided.`
    );
  }
  return folderId;
}

// Assign global functions
_octopusScheduler_addDriveData = (driveData: DriveData): string => {
  try {
    const resolvedFolder = getAssetFolderId(driveData.parentFolderId);
    driveData.parentFolderId = resolvedFolder;
    const result = driveService.addDriveData(driveData);
    return JSON.stringify({ status: "success", data: result.data! });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

_octopusScheduler_getDriveMetaData = (folderId?: string): string => {
  try {
    const resolved =
      folderId && folderId.trim() !== ""
        ? folderId
        : getAssetFolderId(folderId);
    const result = driveService.getDriveMetaData(resolved);
    result.forEach((m) => {
      if (!m.parentFolderId) m.parentFolderId = resolved;
    });
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

_octopusScheduler_getDriveData = (dataId: string): string => {
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

_octopusScheduler_removeDriveData = (dataId: string): string => {
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

_octopusScheduler_updateDriveData = (driveData: DriveData): string => {
  try {
    const result = driveService.updateDriveData(driveData);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

// JSON endpoints for settings and structured JSON files
_octopusScheduler_addJsonData = (driveJson: DriveJsonData): string => {
  try {
    const folderId = getJsonFolderId(driveJson.parentFolderId);

    if (!driveJson.jsonText || !driveJson.fileName) {
      return JSON.stringify({ status: "error", message: "invalid parameters" });
    }

    const blob = Utilities.newBlob(
      driveJson.jsonText,
      "application/json",
      driveJson.fileName
    );
    const folder = DriveApp.getFolderById(folderId);
    const file = folder.createFile(blob);

    const metadata: DriveMetadata = {
      driveDataId: file.getId(),
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

_octopusScheduler_getJsonData = (fileId?: string): string => {
  try {
    if (fileId && fileId.trim() !== "") {
      try {
        const file = DriveApp.getFileById(fileId);
        const content = file.getBlob().getDataAsString();
        return JSON.stringify({ status: "success", data: { json: content } });
      } catch (e) {
        // Not a Drive ID or not found — fallthrough to attempt folder-based lookup
      }
    }

    // If no fileId provided or lookup by id failed, attempt to return an empty object
    return JSON.stringify({
      status: "success",
      data: { json: JSON.stringify({}) },
    });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

_octopusScheduler_listJsonMetaData = (folderId?: string): string => {
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

_octopusScheduler_updateJsonData = (driveJson: DriveJsonData): string => {
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

// Spreadsheet functions removed as part of staged cleanup.

_octopusScheduler_getKeyboardShortcuts = (): string => {
  try {
    const properties = PropertiesService.getScriptProperties();
    const shortcutsStr = properties.getProperty("keyboard-shortcuts");
    const configStr = properties.getProperty("keyboard-shortcuts-config");
    const shortcuts = shortcutsStr ? JSON.parse(shortcutsStr) : [];
    const config = configStr ? JSON.parse(configStr) : { enabled: true };
    return JSON.stringify({ status: "success", data: { shortcuts, config } });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

_octopusScheduler_setKeyboardShortcuts = (payload: {
  shortcuts: string[][];
  config: any;
}): string => {
  try {
    const properties = PropertiesService.getScriptProperties();
    properties.setProperty(
      "keyboard-shortcuts",
      JSON.stringify(payload.shortcuts)
    );
    properties.setProperty(
      "keyboard-shortcuts-config",
      JSON.stringify(payload.config)
    );
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

_octopusScheduler_doGet = (e: GoogleAppsScript.Events.DoGet) => {
  try {
    try {
      LockService.getScriptLock().releaseLock();
    } catch {}

    const template = HtmlService.createTemplateFromFile("index");
    return template
      .evaluate()
      .setTitle("Sample App")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  } catch (error) {
    console.error(`Error in doGetInternal: ${(error as Error).stack}`);
    return HtmlService.createHtmlOutput(
      `<html><body><h1>エラー</h1><p>アプリケーションの読み込みに失敗しました。</p></body></html>`
    );
  }
};
