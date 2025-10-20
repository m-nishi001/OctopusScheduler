import { build } from "esbuild";

build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "dist/octopus-scheduler-api.js",
  target: "es2020",
  format: "iife",
  platform: "browser",
  banner: {
    js: `
let _doGet, _addDriveData, _getDriveMetaData, _getDriveData, _removeDriveData, _updateDriveData, _addSpreadsheetRecords, _updateSpreadsheetRecords, _getAllSpreadsheetNames, _getSpreadsheetData, _removeSpreadsheetData;
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
function addSpreadsheetRecords(payloadJson) { return _addSpreadsheetRecords.apply(this, [payloadJson]); }
function getAllSpreadsheetNames() { return _getAllSpreadsheetNames.apply(this, []); }
function getSpreadsheetData(sheetName) { return _getSpreadsheetData.apply(this, [sheetName]); }
function removeSpreadsheetData(sheetName) { return _removeSpreadsheetData.apply(this, [sheetName]); }
function updateSpreadsheetRecords(payloadJson) { return _updateSpreadsheetRecords.apply(this, [payloadJson]); }
            `,
  },
}).catch(() => process.exit(1));
