// Google Drive operations for jackpot-game-api

import {
  DriveData,
  OperationResult,
  DriveMetadata,
  DriveJsonData,
} from "../../../common/src/drive-types";
// Responses returned as JSON strings for client-side parsing
import { GoogleDriveService } from "../../../common/src/google-drive-service";

declare let _jackpotGame_addDriveData: (driveData: DriveData) => string;
declare let _jackpotGame_getDriveMetaData: (folderId?: string) => string;
declare let _jackpotGame_getDriveData: (dataId: string) => string;
declare let _jackpotGame_removeDriveData: (dataId: string) => string;
declare let _jackpotGame_updateDriveData: (driveData: DriveData) => string;
declare let _jackpotGame_addJson: (driveJson: DriveJsonData) => string;
declare let _jackpotGame_getJson: (fileId?: string) => string;
declare let _jackpotGame_addJsonData: (driveJson: DriveJsonData) => string;
declare let _jackpotGame_getJsonData: (fileId?: string) => string;
declare let _jackpotGame_listJsonMetaData: (folderId?: string) => string;
declare let _jackpotGame_updateJsonData: (driveJson: DriveJsonData) => string;

// Instantiate services
const driveService = new GoogleDriveService();

// Hard-coded ScriptProperty keys (project-specific)
const JSON_FOLDER_PROPERTY = "jackpot-game-json-folder";
const ASSET_FOLDER_PROPERTY = "jackpot-game-asset-folder";

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

// Assign global functions
_jackpotGame_addDriveData = (driveData: DriveData): string => {
  try {
    const result = driveService.addDriveData(driveData);
    return JSON.stringify({ status: "success", data: result.data! });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

_jackpotGame_getDriveMetaData = (folderId?: string): string => {
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

_jackpotGame_getDriveData = (dataId: string): string => {
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

_jackpotGame_removeDriveData = (dataId: string): string => {
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

_jackpotGame_updateDriveData = (driveData: DriveData): string => {
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

_jackpotGame_addJson = (driveJson: DriveJsonData): string => {
  try {
    const folderId = getJsonFolderId(driveJson.parentFolderId);

    // jsonText is required; create an application/json blob from it.
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

_jackpotGame_getJson = (fileId?: string): string => {
  try {
    // Make sure even if getJsonFolderId throws, we handle it gracefully
    let folderId = "";
    try {
      folderId = getJsonFolderId();
    } catch (e) {
      // Can't find json folder — log and return an empty JSON array so
      // client-side callers still get a well-formed response.
      console.warn("getJson: json folder id not configured or not provided", e);
      return JSON.stringify({
        status: "success",
        data: { json: JSON.stringify([]) },
      });
    }
    const folder = DriveApp.getFolderById(folderId);

    // If a fileId (either Drive ID or application-level id) is supplied,
    // attempt to fetch by Drive ID first; if that fails, try to locate by
    // filename prefix (<appFileId>_prizes.json).
    if (fileId && fileId.trim() !== "") {
      try {
        const file = DriveApp.getFileById(fileId);
        const content = file.getBlob().getDataAsString();
        return JSON.stringify({ status: "success", data: { json: content } });
      } catch (e) {
        // Not a Drive ID or file not found by ID — try by filename prefix
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
        // Not found -> fall through to the default behavior
      }
    }

    const files = folder.getFilesByName("prizes.json");
    if (!files.hasNext()) {
      // If no prizes.json file exists, return an empty array JSON string instead
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
    if (!Array.isArray(parsed)) {
      parsed = [];
    }
    return JSON.stringify({
      status: "success",
      data: { json: JSON.stringify(parsed) },
    });
  } catch (error) {
    // Always return a success response with an empty JSON array if an unexpected
    // error occurs here to ensure the client always receives a well-formed
    // value. Still log the error for diagnostics.
    console.error("_jackpotGame_getJson error:", (error as Error).message);
    return JSON.stringify({
      status: "success",
      data: { json: JSON.stringify([]) },
    });
  }
};

// Aliases (octopus-compatible names)
_jackpotGame_addJsonData = (driveJson: DriveJsonData): string => {
  try {
    // Delegate to existing implementation
    return _jackpotGame_addJson(driveJson);
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

_jackpotGame_getJsonData = (fileId?: string): string => {
  try {
    return _jackpotGame_getJson(fileId);
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

_jackpotGame_listJsonMetaData = (folderId?: string): string => {
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

_jackpotGame_updateJsonData = (driveJson: DriveJsonData): string => {
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
