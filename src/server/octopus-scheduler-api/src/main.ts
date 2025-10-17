// Google Drive and Spreadsheet CRUD operations for octopus-scheduler-api

import {
  GoogleDriveService,
  DriveData,
  DriveMetadata,
  OperationResult,
} from "../../common/src/google-drive-service";
import {
  SpreadsheetService,
  SpreadsheetData,
} from "../../common/src/google-spreadsheet-service";

declare let _doGet: (
  e: GoogleAppsScript.Events.DoGet
) => GoogleAppsScript.HTML.HtmlOutput;

declare let _addDriveData: (
  driveData: DriveData
) => OperationResult<DriveMetadata>;
declare let _getDriveMetaData: (folderId: string) => DriveMetadata[];
declare let _getDriveData: (dataId: string) => DriveData | null;
declare let _removeDriveData: (dataId: string) => void;
declare let _updateDriveData: (driveData: DriveData) => OperationResult<void>;
declare let _upsertSpreadsheetData: (spreadsheetData: SpreadsheetData) => void;
declare let _getAllSpreadsheetNames: () => string[];
declare let _getSpreadsheetData: (sheetName: string) => SpreadsheetData | null;
declare let _removeSpreadsheetData: (sheetName: string) => void;

// Instantiate services
const driveService = new GoogleDriveService();
const spreadsheetId = PropertiesService.getScriptProperties().getProperty(
  "octopus-schedule-api-spreadsheet"
);
const spreadsheetService = new SpreadsheetService(spreadsheetId);

// Assign global functions
_addDriveData = driveService.addDriveData.bind(driveService);
_getDriveMetaData = driveService.getDriveMetaData.bind(driveService);
_getDriveData = driveService.getDriveData.bind(driveService);
_removeDriveData = driveService.removeDriveData.bind(driveService);
_updateDriveData = driveService.updateDriveData.bind(driveService);

_upsertSpreadsheetData =
  spreadsheetService.upsertSpreadsheetData.bind(spreadsheetService);
_getAllSpreadsheetNames =
  spreadsheetService.getAllSpreadsheetNames.bind(spreadsheetService);
_getSpreadsheetData =
  spreadsheetService.getSpreadsheetData.bind(spreadsheetService);
_removeSpreadsheetData =
  spreadsheetService.removeSpreadsheetData.bind(spreadsheetService);

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
