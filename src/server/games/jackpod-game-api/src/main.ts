// Google Drive and Spreadsheet CRUD operations for jackpot-game-api

import {
  DriveData,
  OperationResult,
  DriveMetadata,
  DriveJsonData,
} from "../../../common/src/drive-types";
import { GasResponse } from "../../../common/src/gas-types";
import { GoogleDriveService } from "../../../common/src/google-drive-service";
import {
  SpreadsheetService,
  SpreadsheetData,
} from "../../../common/src/google-spreadsheet-service";

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
declare let _jackpotGame_upsertSpreadsheetData: (
  spreadsheetData: SpreadsheetData
) => GasResponse<void>;
declare let _jackpotGame_getAllSpreadsheetNames: () => GasResponse<string[]>;
declare let _jackpotGame_getSpreadsheetData: (
  sheetName: string
) => GasResponse<SpreadsheetData | null>;
declare let _jackpotGame_removeSpreadsheetData: (
  sheetName: string
) => GasResponse<void>;
declare let _jackpotGame_addJson: (
  driveJson: DriveJsonData
) => GasResponse<DriveMetadata>;
declare let _jackpotGame_getJson: (
  fileId: string
) => GasResponse<{ json: string } | null>;

// Instantiate services
const driveService = new GoogleDriveService();
const spreadsheetId = PropertiesService.getScriptProperties().getProperty(
  "jackpot-game-api-spreadsheet"
);
const spreadsheetService = new SpreadsheetService(spreadsheetId);

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

_jackpotGame_upsertSpreadsheetData = (
  spreadsheetData: SpreadsheetData
): GasResponse<void> => {
  try {
    spreadsheetService.upsertSpreadsheetData(spreadsheetData);
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_jackpotGame_getAllSpreadsheetNames = (): GasResponse<string[]> => {
  try {
    const result = spreadsheetService.getAllSpreadsheetNames();
    return { status: "success", data: result };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_jackpotGame_getSpreadsheetData = (
  sheetName: string
): GasResponse<SpreadsheetData | null> => {
  try {
    const result = spreadsheetService.getSpreadsheetData(sheetName);
    return { status: "success", data: result };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_jackpotGame_removeSpreadsheetData = (sheetName: string): GasResponse<void> => {
  try {
    spreadsheetService.removeSpreadsheetData(sheetName);
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
    const file = folder.createFile(blob);
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

_jackpotGame_getJson = (
  fileId: string
): GasResponse<{ json: string } | null> => {
  try {
    const file = DriveApp.getFileById(fileId);
    const content = file.getBlob().getDataAsString();
    return { status: "success", data: { json: content } };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};
