// Google Drive and Spreadsheet CRUD operations for jackpot-game-api

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

// Google Drive operations
_addDriveData = function (driveData: DriveData): void {
  const blob = Utilities.newBlob(
    Utilities.base64Decode(driveData.fileData),
    driveData.fileKind,
    driveData.fileName
  );
  const file = DriveApp.createFile(blob);
  file.setName(driveData.fileName);
  // Note: Need to set parent folder if needed
};

_getDriveMetaData = function (): DriveMetadata[] {
  // Implement get drive metadata
  // Return list of metadata
  const files = DriveApp.getFiles();
  const metadata: DriveMetadata[] = [];
  while (files.hasNext()) {
    const file = files.next();
    metadata.push({
      fileId: file.getId(),
      lastUpdate: new Date(file.getLastUpdated().getTime()),
    });
  }
  return metadata;
};

_getDriveData = function (dataId: string): DriveData | null {
  try {
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
  } catch {
    return null;
  }
};

_removeDriveData = function (dataId: string): void {
  try {
    const file = DriveApp.getFileById(dataId);
    file.setTrashed(true);
  } catch {
    // Ignore if file not found
  }
};

_updateDriveData = function (driveData: DriveData): void {
  try {
    const file = DriveApp.getFileById(driveData.fileId);
    const blob = Utilities.newBlob(
      Utilities.base64Decode(driveData.fileData),
      driveData.fileKind,
      driveData.fileName
    );
    file.setContent(blob.getDataAsString());
    file.setName(driveData.fileName);
  } catch {
    // Ignore if file not found
  }
};

// Spreadsheet operations
_addSpreadsheetData = function (spreadsheetData: SpreadsheetData): void {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(
    "jackpot-game-api-spreadsheet"
  );
  if (!spreadsheetId) return;
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(spreadsheetData.sheetName);
  if (!sheet) return;
  const data = spreadsheetData.data;
  if (data.length > 0) {
    sheet
      .getRange(sheet.getLastRow() + 1, 1, data.length, data[0].length)
      .setValues(data);
  }
};

_getAllSpreadsheetNames = function (): string[] {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(
    "jackpot-game-api-spreadsheet"
  );
  if (!spreadsheetId) return [];
  const ss = SpreadsheetApp.openById(spreadsheetId);
  return ss.getSheets().map((sheet) => sheet.getName());
};

_getSpreadsheetData = function (sheetName: string): SpreadsheetData | null {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(
    "jackpot-game-api-spreadsheet"
  );
  if (!spreadsheetId) return null;
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  return { sheetName, data };
};

_removeSpreadsheetData = function (sheetName: string): void {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(
    "jackpot-game-api-spreadsheet"
  );
  if (!spreadsheetId) return;
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (sheet) {
    spreadsheet.deleteSheet(sheet);
  }
};

_updateSpreadsheetData = function (
  sheetName: string,
  spreadsheetData: SpreadsheetData
): void {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(
    "jackpot-game-api-spreadsheet"
  );
  if (!spreadsheetId) return;
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return;
  sheet.clear();
  const data = spreadsheetData.data;
  if (data.length > 0) {
    sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  }
};
