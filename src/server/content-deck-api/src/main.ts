// Google Drive and Spreadsheet CRUD operations for content-deck-api

import { GoogleDriveService } from "../../shared-packages/src/google-drive-service";
import { SpreadsheetService } from "../../shared-packages/src/google-spreadsheet-service";

interface DriveData {
  fileId: string;
  fileName: string;
  fileKind: string; // MimeType
  fileData: string; // dataUrl
  uploadDate: Date;
  lastUpdate: Date;
}

interface DriveMetadata {
  fileId: string;
  lastUpdate: Date;
}

interface SpreadsheetData {
  sheetName: string;
  data: any[][]; // 2D array
}

declare let _addDriveData: (driveData: DriveData) => void;
declare let _getDriveMetaData: () => DriveMetadata[];
declare let _getDriveData: (dataId: string) => DriveData | null;
declare let _removeDriveData: (dataId: string) => void;
declare let _updateDriveData: (driveData: DriveData) => void;
declare let _addSpreadsheetData: (spreadsheetData: SpreadsheetData) => void;
declare let _getAllSpreadsheetNames: () => string[];
declare let _getSpreadsheetData: (sheetName: string) => SpreadsheetData | null;
declare let _removeSpreadsheetData: (sheetName: string) => void;
declare let _updateSpreadsheetData: (
  sheetName: string,
  spreadsheetData: SpreadsheetData
) => void;

// Instantiate services
const driveService = new GoogleDriveService();
const spreadsheetId = PropertiesService.getScriptProperties().getProperty(
  "content-deck-api-spreadsheet"
);
const spreadsheetService = new SpreadsheetService(spreadsheetId);

// Assign global functions
_addDriveData = driveService.addDriveData.bind(driveService);
_getDriveMetaData = driveService.getDriveMetaData.bind(driveService);
_getDriveData = driveService.getDriveData.bind(driveService);
_removeDriveData = driveService.removeDriveData.bind(driveService);
_updateDriveData = driveService.updateDriveData.bind(driveService);

_addSpreadsheetData =
  spreadsheetService.addSpreadsheetData.bind(spreadsheetService);
_getAllSpreadsheetNames =
  spreadsheetService.getAllSpreadsheetNames.bind(spreadsheetService);
_getSpreadsheetData =
  spreadsheetService.getSpreadsheetData.bind(spreadsheetService);
_removeSpreadsheetData =
  spreadsheetService.removeSpreadsheetData.bind(spreadsheetService);
_updateSpreadsheetData =
  spreadsheetService.updateSpreadsheetData.bind(spreadsheetService);
