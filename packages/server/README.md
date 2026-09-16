# jackpot-game-api - Notes

This package provides Google Apps Script (GAS) Drive/JSON helpers used by the jackpot-game client.

Exported GAS globals (aliases added for octopus-compatible naming):

- `addJsonData` — create/upload a JSON file (returns `DriveMetadata`).
- `getJsonData` — fetch JSON content by Drive `fileId` or application-level id (returns `{ json: string }`).
- `listJsonMetaData` — list metadata for JSON files in a folder (returns `DriveMetadata[]`).
- `updateJsonData` — update JSON content of an existing Drive file (requires `metadata.fileId`).

ScriptProperty keys:

- `jackpot-game-asset-folder-id` — the Drive folder id used by this API for assets and JSON files. The server will fall back to this ScriptProperty when a `parentFolderId` is not provided by the client. Make sure this ScriptProperty is configured in the GAS project.

Notes:

- When calling `updateJsonData`, the client must include `metadata.fileId` in the `DriveJsonData` payload; otherwise the server returns an error.
- Filenames stored by the server may include an application-level id prefix (e.g. `<appFileId>_prizes.json`) to allow locating files by app id.
