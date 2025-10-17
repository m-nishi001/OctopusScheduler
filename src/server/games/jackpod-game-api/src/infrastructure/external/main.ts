// import { GoogleDriveService, SpreadsheetService } from "../../../../shared-packages/src";

interface DriveData {
  fileId: string;
  fileName: string;
  fileKind: string;
  fileData: string;
  uploadDate: Date;
  lastUpdate: Date;
}

interface DriveMetadata {
  fileId: string;
  lastUpdate: Date;
}

interface SpreadsheetData {
  sheetName: string;
  data: any[][];
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

_addDriveData = (driveData: DriveData): void => {
  const blob = Utilities.newBlob(
    Utilities.base64Decode(driveData.fileData),
    driveData.fileKind,
    driveData.fileName
  );
  const file = DriveApp.createFile(blob);
  file.setName(driveData.fileName);
  // Note: Need to set parent folder if needed
};

_getDriveMetaData = (): DriveMetadata[] => {
  // Implement get drive metadata
  // Return list of metadata
  return [];
};

_getDriveData = (dataId: string): DriveData | null => {
  const file = DriveApp.getFileById(dataId);
  const blob = file.getBlob();
  const dataUrl = Utilities.base64Encode(blob.getBytes());
  return {
    fileId: dataId,
    fileName: file.getName(),
    fileKind: file.getMimeType(),
    fileData: dataUrl,
    uploadDate: new Date(file.getDateCreated().getTime()),
    lastUpdate: new Date(file.getLastUpdated().getTime()),
  };
};

_removeDriveData = (dataId: string): void => {
  const file = DriveApp.getFileById(dataId);
  file.setTrashed(true);
};

_updateDriveData = (driveData: DriveData): void => {
  const file = DriveApp.getFileById(driveData.fileId);
  const blob = Utilities.newBlob(
    Utilities.base64Decode(driveData.fileData),
    driveData.fileKind,
    driveData.fileName
  );
  file.setContent(blob.getDataAsString());
  file.setName(driveData.fileName);
};

_addSpreadsheetData = (spreadsheetData: SpreadsheetData): void => {
  const spreadsheet = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty(
      "jackpot-game-api-spreadsheet"
    ) || ""
  );
  const sheet = spreadsheet.getSheetByName(spreadsheetData.sheetName);
  if (!sheet) return;
  const data = spreadsheetData.data;
  sheet
    .getRange(sheet.getLastRow() + 1, 1, data.length, data[0].length)
    .setValues(data);
};

_getAllSpreadsheetNames = (): string[] => {
  // Implement get all sheet names
  const ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty(
      "jackpot-game-api-spreadsheet"
    ) || ""
  );
  return ss.getSheets().map((sheet) => sheet.getName());
};

_getSpreadsheetData = (sheetName: string): SpreadsheetData | null => {
  const spreadsheet = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty(
      "jackpot-game-api-spreadsheet"
    ) || ""
  );
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  return { sheetName, data };
};

_removeSpreadsheetData = (sheetName: string): void => {
  const spreadsheet = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty(
      "jackpot-game-api-spreadsheet"
    ) || ""
  );
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (sheet) {
    spreadsheet.deleteSheet(sheet);
  }
};

_updateSpreadsheetData = (
  sheetName: string,
  spreadsheetData: SpreadsheetData
): void => {
  const spreadsheet = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty(
      "jackpot-game-api-spreadsheet"
    ) || ""
  );
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return;
  sheet.clear();
  if (spreadsheetData.data.length > 0) {
    sheet
      .getRange(
        1,
        1,
        spreadsheetData.data.length,
        spreadsheetData.data[0].length
      )
      .setValues(spreadsheetData.data);
  }
};
