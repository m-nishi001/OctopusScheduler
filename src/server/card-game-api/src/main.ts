// Google Drive and Spreadsheet CRUD operations for card-game-api

import {
  DriveData,
  OperationResult,
  DriveMetadata,
} from "../../../common/src/drive-types";
// Responses returned as JSON strings for client-side parsing
import { GoogleDriveService } from "../../../common/src/google-drive-service";
import {
  SpreadsheetService,
  SpreadsheetData,
} from "../../../common/src/google-spreadsheet-service";

declare let _cardGame_addDriveData: (driveData: DriveData) => string;
declare let _cardGame_getDriveMetaData: (folderId: string) => string;
declare let _cardGame_getDriveData: (dataId: string) => string;
declare let _cardGame_removeDriveData: (dataId: string) => string;
declare let _cardGame_updateDriveData: (driveData: DriveData) => string;
declare let _cardGame_upsertSpreadsheetData: (
  spreadsheetData: SpreadsheetData
) => string;
declare let _cardGame_getAllSpreadsheetNames: () => string;
declare let _cardGame_getSpreadsheetData: (sheetName: string) => string;
declare let _cardGame_removeSpreadsheetData: (sheetName: string) => string;

// Instantiate services
const driveService = new GoogleDriveService();
const spreadsheetId = PropertiesService.getScriptProperties().getProperty(
  "card-game-api-spreadsheet"
);
const spreadsheetService = new SpreadsheetService(spreadsheetId);

// Assign global functions
_cardGame_addDriveData = (driveData: DriveData): string => {
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

_cardGame_getDriveMetaData = (folderId: string): string => {
  try {
    const result = driveService.getDriveMetaData(folderId);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

_cardGame_getDriveData = (dataId: string): string => {
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

_cardGame_removeDriveData = (dataId: string): string => {
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

_cardGame_updateDriveData = (driveData: DriveData): string => {
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

_cardGame_upsertSpreadsheetData = (
  spreadsheetData: SpreadsheetData
): string => {
  try {
    spreadsheetService.upsertSpreadsheetData(spreadsheetData);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

_cardGame_getAllSpreadsheetNames = (): string => {
  try {
    const result = spreadsheetService.getAllSpreadsheetNames();
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

_cardGame_getSpreadsheetData = (sheetName: string): string => {
  try {
    const result = spreadsheetService.getSpreadsheetData(sheetName);
    return JSON.stringify({ status: "success", data: result });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};

_cardGame_removeSpreadsheetData = (sheetName: string): string => {
  try {
    spreadsheetService.removeSpreadsheetData(sheetName);
    return JSON.stringify({ status: "success", data: undefined });
  } catch (error) {
    return JSON.stringify({
      status: "error",
      message: (error as Error).message,
    });
  }
};
