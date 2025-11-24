import {
  DriveData,
  DriveMetadata,
  DriveJsonData,
} from "../../common/src/drive-types";
import { GasResponse } from "../../common/src/gas-types";
import { GoogleDriveService } from "../../common/src/google-drive-service";

declare let _octopusScheduler_doGet: (
  e: GoogleAppsScript.Events.DoGet
) => GoogleAppsScript.HTML.HtmlOutput;

declare let _octopusScheduler_addDriveData: (
  driveData: DriveData
) => GasResponse<DriveMetadata>;
declare let _octopusScheduler_getDriveMetaData: (
  folderId: string
) => GasResponse<DriveMetadata[]>;
declare let _octopusScheduler_getDriveData: (
  dataId: string
) => GasResponse<DriveData | null>;
declare let _octopusScheduler_removeDriveData: (
  dataId: string
) => GasResponse<void>;
declare let _octopusScheduler_updateDriveData: (
  driveData: DriveData
) => GasResponse<void>;
declare let _octopusScheduler_addJsonData: (
  driveJson: DriveJsonData
) => GasResponse<DriveMetadata>;
declare let _octopusScheduler_getJsonData: (
  fileId?: string
) => GasResponse<{ json: string }>;
declare let _octopusScheduler_listJsonMetaData: (
  folderId?: string
) => GasResponse<DriveMetadata[]>;
declare let _octopusScheduler_updateJsonData: (
  driveJson: DriveJsonData
) => GasResponse<void>;
declare let _octopusScheduler_getKeyboardShortcuts: () => GasResponse<{
  shortcuts: any[];
  config: any;
}>;
declare let _octopusScheduler_setKeyboardShortcuts: (payload: {
  shortcuts: string[][];
  config: any;
}) => GasResponse<void>;

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

// Assign global functions
_octopusScheduler_addDriveData = (
  driveData: DriveData
): GasResponse<DriveMetadata> => {
  try {
    const result = driveService.addDriveData(driveData);
    return { status: "success", data: result.data! };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_octopusScheduler_getDriveMetaData = (
  folderId: string
): GasResponse<DriveMetadata[]> => {
  try {
    const result = driveService.getDriveMetaData(folderId);
    return { status: "success", data: result };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_octopusScheduler_getDriveData = (
  dataId: string
): GasResponse<DriveData | null> => {
  try {
    const result = driveService.getDriveData(dataId);
    return { status: "success", data: result };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_octopusScheduler_removeDriveData = (dataId: string): GasResponse<void> => {
  try {
    driveService.removeDriveData(dataId);
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_octopusScheduler_updateDriveData = (
  driveData: DriveData
): GasResponse<void> => {
  try {
    const result = driveService.updateDriveData(driveData);
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

// JSON endpoints for settings and structured JSON files
_octopusScheduler_addJsonData = (
  driveJson: DriveJsonData
): GasResponse<DriveMetadata> => {
  try {
    const folderId = getJsonFolderId(driveJson.parentFolderId);

    if (!driveJson.jsonText || !driveJson.fileName) {
      return { status: "error", message: "invalid parameters" };
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
    return { status: "success", data: metadata };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_octopusScheduler_getJsonData = (
  fileId?: string
): GasResponse<{ json: string }> => {
  try {
    if (fileId && fileId.trim() !== "") {
      try {
        const file = DriveApp.getFileById(fileId);
        const content = file.getBlob().getDataAsString();
        return { status: "success", data: { json: content } };
      } catch (e) {
        // Not a Drive ID or not found — fallthrough to attempt folder-based lookup
      }
    }

    // If no fileId provided or lookup by id failed, attempt to return an empty object
    return { status: "success", data: { json: JSON.stringify({}) } };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_octopusScheduler_listJsonMetaData = (
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

_octopusScheduler_updateJsonData = (
  driveJson: DriveJsonData
): GasResponse<void> => {
  try {
    // Prefer metadata.fileId if provided, else fail (file ID policy: Drive fileId is canonical)
    const fileId = driveJson.metadata?.fileId;
    if (!fileId) {
      return {
        status: "error",
        message: "metadata.fileId is required for update",
      };
    }
    const file = DriveApp.getFileById(fileId);
    file.setContent(driveJson.jsonText);
    // Optionally update filename
    if (driveJson.fileName && driveJson.fileName !== file.getName()) {
      file.setName(driveJson.fileName);
    }
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

// Spreadsheet functions removed as part of staged cleanup.

_octopusScheduler_getKeyboardShortcuts = (): GasResponse<{
  shortcuts: string[][];
  config: any;
}> => {
  try {
    const properties = PropertiesService.getScriptProperties();
    const shortcutsStr = properties.getProperty("keyboard-shortcuts");
    const configStr = properties.getProperty("keyboard-shortcuts-config");
    const shortcuts = shortcutsStr ? JSON.parse(shortcutsStr) : [];
    const config = configStr ? JSON.parse(configStr) : { enabled: true };
    return { status: "success", data: { shortcuts, config } };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_octopusScheduler_setKeyboardShortcuts = (payload: {
  shortcuts: string[][];
  config: any;
}): GasResponse<void> => {
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
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
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
