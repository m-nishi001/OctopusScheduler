// Google Drive and Spreadsheet CRUD operations for card-game-api

import {
  DriveData,
  OperationResult,
  DriveMetadata,
} from "../../../common/src/drive-types";
import { GasResponse } from "../../../common/src/gas-types";
import { GoogleDriveService } from "../../../common/src/google-drive-service";
import {
  SpreadsheetService,
  SpreadsheetData,
} from "../../../common/src/google-spreadsheet-service";

declare let _cardGame_addDriveData: (
  driveData: DriveData
) => GasResponse<DriveMetadata>;
declare let _cardGame_getDriveMetaData: (
  folderId: string
) => GasResponse<DriveMetadata[]>;
declare let _cardGame_getDriveData: (
  dataId: string
) => GasResponse<DriveData | null>;
declare let _cardGame_removeDriveData: (dataId: string) => GasResponse<void>;
declare let _cardGame_updateDriveData: (
  driveData: DriveData
) => GasResponse<void>;
declare let _cardGame_upsertSpreadsheetData: (
  spreadsheetData: SpreadsheetData
) => GasResponse<void>;
declare let _cardGame_getAllSpreadsheetNames: () => GasResponse<string[]>;
declare let _cardGame_getSpreadsheetData: (
  sheetName: string
) => GasResponse<SpreadsheetData | null>;
declare let _cardGame_removeSpreadsheetData: (
  sheetName: string
) => GasResponse<void>;

// Instantiate services
const driveService = new GoogleDriveService();
const spreadsheetId = PropertiesService.getScriptProperties().getProperty(
  "card-game-api-spreadsheet"
);
const spreadsheetService = new SpreadsheetService(spreadsheetId);

// Assign global functions
_cardGame_addDriveData = (driveData: DriveData): GasResponse<DriveMetadata> => {
  try {
    const result = driveService.addDriveData(driveData);
    return { status: "success", data: result.data! };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_cardGame_getDriveMetaData = (
  folderId: string
): GasResponse<DriveMetadata[]> => {
  try {
    const result = driveService.getDriveMetaData(folderId);
    return { status: "success", data: result };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_cardGame_getDriveData = (dataId: string): GasResponse<DriveData | null> => {
  try {
    const result = driveService.getDriveData(dataId);
    return { status: "success", data: result };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_cardGame_removeDriveData = (dataId: string): GasResponse<void> => {
  try {
    driveService.removeDriveData(dataId);
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_cardGame_updateDriveData = (driveData: DriveData): GasResponse<void> => {
  try {
    const result = driveService.updateDriveData(driveData);
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_cardGame_upsertSpreadsheetData = (
  spreadsheetData: SpreadsheetData
): GasResponse<void> => {
  try {
    spreadsheetService.upsertSpreadsheetData(spreadsheetData);
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_cardGame_getAllSpreadsheetNames = (): GasResponse<string[]> => {
  try {
    const result = spreadsheetService.getAllSpreadsheetNames();
    return { status: "success", data: result };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_cardGame_getSpreadsheetData = (
  sheetName: string
): GasResponse<SpreadsheetData | null> => {
  try {
    const result = spreadsheetService.getSpreadsheetData(sheetName);
    return { status: "success", data: result };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_cardGame_removeSpreadsheetData = (sheetName: string): GasResponse<void> => {
  try {
    spreadsheetService.removeSpreadsheetData(sheetName);
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};
