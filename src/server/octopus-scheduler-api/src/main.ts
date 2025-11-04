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

declare let _octopusScheduler_doGet: (
  e: GoogleAppsScript.Events.DoGet
) => GoogleAppsScript.HTML.HtmlOutput;

declare let _octopusScheduler_addDriveData: (
  driveData: DriveData
) => GasResponse<DriveMetadata>;
declare let _octopusScheduler_getDriveMetaData: (
  folderId: string
) => GasResponse<DriveMetadata[]>;
declare let _octopusScheduler_getDriveData: (
  dataId: string
) => GasResponse<DriveData | null>;
declare let _octopusScheduler_removeDriveData: (
  dataId: string
) => GasResponse<void>;
declare let _octopusScheduler_updateDriveData: (
  driveData: DriveData
) => GasResponse<void>;
declare let _octopusScheduler_addSpreadsheetRecords: (
  payloadJson: string
) => GasResponse<{ added: number; duplicates?: string[] }>;
declare let _octopusScheduler_updateSpreadsheetRecords: (
  payloadJson: string
) => GasResponse<{ updated: number; missingIds?: string[] }>;
declare let _octopusScheduler_getAllSpreadsheetNames: () => GasResponse<
  string[]
>;
declare let _octopusScheduler_getSpreadsheetData: (
  sheetName: string
) => GasResponse<SpreadsheetData | null>;
declare let _octopusScheduler_removeSpreadsheetData: (
  sheetName: string
) => GasResponse<void>;
declare let _octopusScheduler_getKeyboardShortcuts: () => GasResponse<{
  shortcuts: any[];
  config: any;
}>;
declare let _octopusScheduler_setKeyboardShortcuts: (payload: {
  shortcuts: string[][];
  config: any;
}) => GasResponse<void>;

// Instantiate services
const driveService = new GoogleDriveService();
const spreadsheetId = PropertiesService.getScriptProperties().getProperty(
  "octopus-schedule-api-spreadsheet"
);
const spreadsheetService = new SpreadsheetService(spreadsheetId);

// Assign global functions
_octopusScheduler_addDriveData = (
  driveData: DriveData
): GasResponse<DriveMetadata> => {
  try {
    const result = driveService.addDriveData(driveData);
    return { status: "success", data: result.data! };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_octopusScheduler_getDriveMetaData = (
  folderId: string
): GasResponse<DriveMetadata[]> => {
  try {
    const result = driveService.getDriveMetaData(folderId);
    return { status: "success", data: result };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_octopusScheduler_getDriveData = (
  dataId: string
): GasResponse<DriveData | null> => {
  try {
    const result = driveService.getDriveData(dataId);
    return { status: "success", data: result };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_octopusScheduler_removeDriveData = (dataId: string): GasResponse<void> => {
  try {
    driveService.removeDriveData(dataId);
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_octopusScheduler_updateDriveData = (
  driveData: DriveData
): GasResponse<void> => {
  try {
    const result = driveService.updateDriveData(driveData);
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_octopusScheduler_addSpreadsheetRecords = (
  payloadJson: string
): GasResponse<{ added: number; duplicates?: string[] }> => {
  try {
    const parsed = JSON.parse(payloadJson || "{}");
    const sheetName: string = parsed.sheetName;
    const recs: Array<{ id: string; type: string; row: any[] }> =
      parsed.records || [];
    if (!sheetName || !Array.isArray(recs)) {
      return { status: "error", message: "invalid parameters" };
    }

    const rows: any[][] = recs.map((r) => [r.id, r.type, ...(r.row || [])]);
    spreadsheetService.appendRows(sheetName, rows);
    return { status: "success", data: { added: rows.length } };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_octopusScheduler_updateSpreadsheetRecords = (
  payloadJson: string
): GasResponse<{ updated: number; missingIds?: string[] }> => {
  try {
    const parsed = JSON.parse(payloadJson || "{}");
    const sheetName: string = parsed.sheetName;
    const recs: Array<{ id: string; type: string; row: any[] }> =
      parsed.records || [];
    if (!sheetName || !Array.isArray(recs)) {
      return { status: "error", message: "invalid parameters" };
    }

    const rowsMap = new Map<string, any[]>();
    for (const r of recs) {
      rowsMap.set(r.id, [r.id, r.type, ...(r.row || [])]);
    }

    const result = spreadsheetService.updateRowsById(sheetName, rowsMap, 1);
    return {
      status: "success",
      data: { updated: result.updated, missingIds: result.missingIds },
    };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_octopusScheduler_getAllSpreadsheetNames = (): GasResponse<string[]> => {
  try {
    const result = spreadsheetService.getAllSpreadsheetNames();
    return { status: "success", data: result };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_octopusScheduler_getSpreadsheetData = (
  sheetName: string
): GasResponse<SpreadsheetData | null> => {
  try {
    const result = spreadsheetService.getSpreadsheetData(sheetName);
    return { status: "success", data: result };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_octopusScheduler_removeSpreadsheetData = (
  sheetName: string
): GasResponse<void> => {
  try {
    spreadsheetService.removeSpreadsheetData(sheetName);
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_octopusScheduler_getKeyboardShortcuts = (): GasResponse<{
  shortcuts: string[][];
  config: any;
}> => {
  try {
    const properties = PropertiesService.getScriptProperties();
    const shortcutsStr = properties.getProperty("keyboard-shortcuts");
    const configStr = properties.getProperty("keyboard-shortcuts-config");
    const shortcuts = shortcutsStr ? JSON.parse(shortcutsStr) : [];
    const config = configStr ? JSON.parse(configStr) : { enabled: true };
    return { status: "success", data: { shortcuts, config } };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_octopusScheduler_setKeyboardShortcuts = (payload: {
  shortcuts: string[][];
  config: any;
}): GasResponse<void> => {
  try {
    const properties = PropertiesService.getScriptProperties();
    properties.setProperty(
      "keyboard-shortcuts",
      JSON.stringify(payload.shortcuts)
    );
    properties.setProperty(
      "keyboard-shortcuts-config",
      JSON.stringify(payload.config)
    );
    return { status: "success", data: undefined };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
};

_octopusScheduler_doGet = (e: GoogleAppsScript.Events.DoGet) => {
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
