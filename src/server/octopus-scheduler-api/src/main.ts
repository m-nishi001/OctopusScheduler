// Google Drive and Spreadsheet CRUD operations for octopus-scheduler-api

import {
  DriveData,
  DriveMetadata,
  OperationResult,
} from "../../common/src/drive-types";
import { GasResponse } from "../../common/src/gas-types";
import { GoogleDriveService } from "../../common/src/google-drive-service";
import {
  SpreadsheetService,
  SpreadsheetData,
} from "../../common/src/google-spreadsheet-service";

declare let _doGet: (
  e: GoogleAppsScript.Events.DoGet
) => GoogleAppsScript.HTML.HtmlOutput;

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

// Instantiate services
const driveService = new GoogleDriveService();
const spreadsheetId = PropertiesService.getScriptProperties().getProperty(
  "octopus-schedule-api-spreadsheet"
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

_doGet = (e: GoogleAppsScript.Events.DoGet) => {
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
