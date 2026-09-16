import {
  DriveData,
} from "../types/drive-types";
// Responses returned as JSON strings for client-side parsing
import { GoogleDriveService } from "../drive/google-drive-service";

declare let _octopusScheduler_doGet: (
  e: GoogleAppsScript.Events.DoGet
) => GoogleAppsScript.HTML.HtmlOutput;

declare let _octopusScheduler_addDriveData: (driveData: DriveData) => string;
declare let _octopusScheduler_getDriveMetaData: (folderId?: string) => string;
declare let _octopusScheduler_getDriveData: (dataId: string) => string;
declare let _octopusScheduler_updateDriveData: (driveData: DriveData) => string;
declare let _octopusScheduler_getKeyboardShortcuts: () => string;
declare let _octopusScheduler_setKeyboardShortcuts: (payload: {
  shortcuts: string[][];
  config: any;
}) => string;

// Instantiate services
const driveService = new GoogleDriveService();

const ASSET_FOLDER_PROPERTY = "octopus-scheduler-asset-folder";

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

_octopusScheduler_updateDriveData = (driveData: DriveData): string => {
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
