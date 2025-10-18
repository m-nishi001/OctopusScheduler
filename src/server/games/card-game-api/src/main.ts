// Google Drive and Spreadsheet CRUD operations for card-game-api

import {
  DriveData,
  OperationResult,
  DriveMetadata,
} from "../../../common/src/drive-types";
import { GoogleDriveService } from "../../../common/src/google-drive-service";
import {
  SpreadsheetService,
  SpreadsheetData,
} from "../../../common/src/google-spreadsheet-service";

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
  "card-game-api-spreadsheet"
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
