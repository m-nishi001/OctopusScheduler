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

declare let _addDriveData: (driveData: DriveData) => GasResponse<DriveMetadata>;
declare let _getDriveMetaData: (
  folderId: string
) => GasResponse<DriveMetadata[]>;
declare let _getDriveData: (dataId: string) => GasResponse<DriveData | null>;
declare let _removeDriveData: (dataId: string) => GasResponse<void>;
declare let _updateDriveData: (driveData: DriveData) => GasResponse<void>;
declare let _upsertSpreadsheetData: (
  spreadsheetData: SpreadsheetData
) => GasResponse<void>;
declare let _getAllSpreadsheetNames: () => GasResponse<string[]>;
declare let _getSpreadsheetData: (
  sheetName: string
) => GasResponse<SpreadsheetData | null>;
declare let _removeSpreadsheetData: (sheetName: string) => GasResponse<void>;
declare let _addJson: (driveJson: DriveJsonData) => GasResponse<DriveMetadata>;
declare let _getJson: (fileId: string) => GasResponse<{ json: string } | null>;

// Instantiate services
const driveService = new GoogleDriveService();
const spreadsheetId = PropertiesService.getScriptProperties().getProperty(
  "jackpot-game-api-spreadsheet"
);
const spreadsheetService = new SpreadsheetService(spreadsheetId);

// Assign global functions
_addDriveData = (driveData: DriveData): GasResponse<DriveMetadata> => {
  try {
    const result = driveService.addDriveData(driveData);
    return { status: "success", data: result.data! };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_getDriveMetaData = (folderId: string): GasResponse<DriveMetadata[]> => {
  try {
    const result = driveService.getDriveMetaData(folderId);
    return { status: "success", data: result };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_getDriveData = (dataId: string): GasResponse<DriveData | null> => {
  try {
    const result = driveService.getDriveData(dataId);
    return { status: "success", data: result };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_removeDriveData = (dataId: string): GasResponse<void> => {
  try {
    driveService.removeDriveData(dataId);
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_updateDriveData = (driveData: DriveData): GasResponse<void> => {
  try {
    const result = driveService.updateDriveData(driveData);
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_upsertSpreadsheetData = (
  spreadsheetData: SpreadsheetData
): GasResponse<void> => {
  try {
    spreadsheetService.upsertSpreadsheetData(spreadsheetData);
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_getAllSpreadsheetNames = (): GasResponse<string[]> => {
  try {
    const result = spreadsheetService.getAllSpreadsheetNames();
    return { status: "success", data: result };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_getSpreadsheetData = (
  sheetName: string
): GasResponse<SpreadsheetData | null> => {
  try {
    const result = spreadsheetService.getSpreadsheetData(sheetName);
    return { status: "success", data: result };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_removeSpreadsheetData = (sheetName: string): GasResponse<void> => {
  try {
    spreadsheetService.removeSpreadsheetData(sheetName);
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_addJson = (driveJson: DriveJsonData): GasResponse<DriveMetadata> => {
  try {
    const folderId =
      driveJson.parentFolderId ||
      PropertiesService.getScriptProperties().getProperty(
        "jackpot-game-asset-folder-id"
      ) ||
      "";
    if (!folderId)
      return { status: "error", message: "folderId not configured" };

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

_getJson = (fileId: string): GasResponse<{ json: string } | null> => {
  try {
    const file = DriveApp.getFileById(fileId);
    const content = file.getBlob().getDataAsString();
    return { status: "success", data: { json: content } };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};
