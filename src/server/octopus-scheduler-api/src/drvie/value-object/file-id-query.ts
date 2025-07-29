import { FileId } from "./file-id";
import { FolderId } from "./folder-id";

export class FileIdQuery {
    public readonly ids: FileId[];
    public readonly parentFolderId: FolderId;

    private constructor(ids: FileId[], parentFolderId: FolderId) {
        this.ids = ids;
        this.parentFolderId = parentFolderId;
    }

    static create(ids: FileId[], parentFolderId: FolderId): FileIdQuery | null {
        if (!ids || ids.length === 0) {
            Logger.log(`[FileIdQuery} ids length is 0.`);
            return null;
        }
        if (!parentFolderId) {
            Logger.log(`[FileIdQuery} parentFolderId was invalid. Input value is ${parentFolderId}`);
            return null;
        }
        return new FileIdQuery(ids, parentFolderId);
    }
}