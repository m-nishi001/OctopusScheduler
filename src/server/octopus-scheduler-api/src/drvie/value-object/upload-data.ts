import { FileId } from "./file-id";
import { FileMimeType } from "./file-mime-type";
import { FileName } from "./file-name";
import { FolderId } from "./folder-id";

export interface UploadData {
    readonly fileId: FileId | null;
    readonly fileName: FileName;
    readonly parentFolderId: FolderId;
    readonly mimeType: FileMimeType;
    readonly blob: GoogleAppsScript.Base.Blob;
}