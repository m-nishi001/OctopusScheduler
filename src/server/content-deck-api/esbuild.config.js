import { build } from "esbuild";

build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "dist/content-deck-api.js",
  target: "es2020",
  format: "iife",
  platform: "browser",
  banner: {
    js: `
let _doGet, _addDriveData, _getDriveMetaData, _getDriveData, _removeDriveData, _updateDriveData, _addSpreadsheetData, _getAllSpreadsheetNames, _getSpreadsheetData, _removeSpreadsheetData, _updateSpreadsheetData;
            `,
  },
  footer: {
    js: `
function doGet(e){
    return _doGet(e);
}

function addDriveData(driveData) { return _addDriveData.apply(this, [driveData]); }
function getDriveMetaData() { return _getDriveMetaData.apply(this, []); }
function getDriveData(dataId) { return _getDriveData.apply(this, [dataId]); }
function removeDriveData(dataId) { return _removeDriveData.apply(this, [dataId]); }
function updateDriveData(driveData) { return _updateDriveData.apply(this, [driveData]); }
function addSpreadsheetData(spreadsheetData) { return _addSpreadsheetData.apply(this, [spreadsheetData]); }
function getAllSpreadsheetNames() { return _getAllSpreadsheetNames.apply(this, []); }
function getSpreadsheetData(sheetName) { return _getSpreadsheetData.apply(this, [sheetName]); }
function removeSpreadsheetData(sheetName) { return _removeSpreadsheetData.apply(this, [sheetName]); }
function updateSpreadsheetData(sheetName, spreadsheetData) { return _updateSpreadsheetData.apply(this, [sheetName, spreadsheetData]); }
            `,
  },
}).catch(() => process.exit(1));
