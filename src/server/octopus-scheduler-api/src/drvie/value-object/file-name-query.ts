import { FileName } from "./file-name";
import { FolderId } from "./folder-id";

export interface FileNameQuery {
    readonly fileName: FileName;
    readonly parentFolderId: FolderId;
}