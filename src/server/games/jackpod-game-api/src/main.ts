// Google Drive operations for jackpot-game-api

import {
  DriveData,
  OperationResult,
  DriveMetadata,
  DriveJsonData,
} from "../../../common/src/drive-types";
import { GasResponse } from "../../../common/src/gas-types";
import { GoogleDriveService } from "../../../common/src/google-drive-service";

declare let _jackpotGame_addDriveData: (
  driveData: DriveData
) => GasResponse<DriveMetadata>;
declare let _jackpotGame_getDriveMetaData: (
  folderId: string
) => GasResponse<DriveMetadata[]>;
declare let _jackpotGame_getDriveData: (
  dataId: string
) => GasResponse<DriveData | null>;
declare let _jackpotGame_removeDriveData: (dataId: string) => GasResponse<void>;
declare let _jackpotGame_updateDriveData: (
  driveData: DriveData
) => GasResponse<void>;
declare let _jackpotGame_addJson: (
  driveJson: DriveJsonData
) => GasResponse<DriveMetadata>;
declare let _jackpotGame_getJson: (
  fileId?: string
) => GasResponse<{ json: string }>;

// Instantiate services
const driveService = new GoogleDriveService();

// Helper: resolve the asset folder id to use for uploads. Prefer provided folderId,
// otherwise fall back to ScriptProperties key 'jackpot-game-asset-folder-id'.
function getAssetFolderId(providedFolderId?: string): string {
  const folderId =
    providedFolderId ||
    PropertiesService.getScriptProperties().getProperty(
      "jackpot-game-asset-folder-id"
    ) ||
    "";
  if (!folderId) {
    throw new Error(
      "ScriptProperties 'jackpot-game-asset-folder-id' is not configured and no parentFolderId was provided."
    );
  }
  return folderId;
}

// Assign global functions
_jackpotGame_addDriveData = (
  driveData: DriveData
): GasResponse<DriveMetadata> => {
  try {
    const result = driveService.addDriveData(driveData);
    return { status: "success", data: result.data! };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_jackpotGame_getDriveMetaData = (
  folderId: string
): GasResponse<DriveMetadata[]> => {
  try {
    const result = driveService.getDriveMetaData(folderId);
    return { status: "success", data: result };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_jackpotGame_getDriveData = (dataId: string): GasResponse<DriveData | null> => {
  try {
    const result = driveService.getDriveData(dataId);
    return { status: "success", data: result };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_jackpotGame_removeDriveData = (dataId: string): GasResponse<void> => {
  try {
    driveService.removeDriveData(dataId);
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_jackpotGame_updateDriveData = (driveData: DriveData): GasResponse<void> => {
  try {
    const result = driveService.updateDriveData(driveData);
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_jackpotGame_addJson = (
  driveJson: DriveJsonData
): GasResponse<DriveMetadata> => {
  try {
    const folderId = getAssetFolderId(driveJson.parentFolderId);

    // jsonText is required; create an application/json blob from it.
    const blob = Utilities.newBlob(
      driveJson.jsonText,
      "application/json",
      driveJson.fileName
    );
    const folder = DriveApp.getFolderById(folderId);

    // If the client supplied an application-level fileId, use it as the
    // prefix in the stored filename so we can later find it by that id.
    // Note: this value is an application-managed id and should be sent in
    // the top-level `appFileId` property. `metadata` is reserved for
    // Drive-specific metadata and is initialized server-side.
    const appFileId = driveJson.appFileId ?? "";
    const nameToSet = appFileId
      ? `${appFileId}_${driveJson.fileName}`
      : driveJson.fileName;

    const file = folder.createFile(blob);
    // Ensure consistent name format based on client-supplied id
    file.setName(nameToSet);
    const metadata: DriveMetadata = {
      // driveDataId is derived from the filename prefix or falls back to
      // the Drive file id if not present.
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

_jackpotGame_getJson = (fileId?: string): GasResponse<{ json: string }> => {
  try {
    // Make sure even if getAssetFolderId throws, we handle it gracefully
    let folderId = "";
    try {
      folderId = getAssetFolderId();
    } catch (e) {
      // Can't find asset folder — log and return an empty JSON array so
      // client-side callers still get a well-formed response.
      console.warn(
        "getJson: asset folder id not configured or not provided",
        e
      );
      return { status: "success", data: { json: JSON.stringify([]) } };
    }
    const folder = DriveApp.getFolderById(folderId);

    // If a fileId (either Drive ID or application-level id) is supplied,
    // attempt to fetch by Drive ID first; if that fails, try to locate by
    // filename prefix (<appFileId>_prizes.json).
    if (fileId && fileId.trim() !== "") {
      try {
        const file = DriveApp.getFileById(fileId);
        const content = file.getBlob().getDataAsString();
        return { status: "success", data: { json: content } };
      } catch (e) {
        // Not a Drive ID or file not found by ID — try by filename prefix
        const filesByPrefix = folder.getFiles();
        while (filesByPrefix.hasNext()) {
          const f = filesByPrefix.next();
          if (f.getName().startsWith(`${fileId}_`)) {
            const content = f.getBlob().getDataAsString();
            return { status: "success", data: { json: content } };
          }
        }
        // Not found -> fall through to the default behavior
      }
    }

    const files = folder.getFilesByName("prizes.json");
    if (!files.hasNext()) {
      // If no prizes.json file exists, return an empty array JSON string instead
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
    if (!Array.isArray(parsed)) {
      parsed = [];
    }
    return { status: "success", data: { json: JSON.stringify(parsed) } };
  } catch (error) {
    // Always return a success response with an empty JSON array if an unexpected
    // error occurs here to ensure the client always receives a well-formed
    // value. Still log the error for diagnostics.
    console.error("_jackpotGame_getJson error:", (error as Error).message);
    return { status: "success", data: { json: JSON.stringify([]) } };
  }
};
