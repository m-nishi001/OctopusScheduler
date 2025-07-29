import { FileId } from "./value-object/file-id";
import { FileIdQuery } from "./value-object/file-id-query";
import { FileNameQuery } from "./value-object/file-name-query";
import { FolderId } from "./value-object/folder-id";
import { UploadData } from "./value-object/upload-data";

export class DriveService {
    static findFileByName(query: FileNameQuery): GoogleAppsScript.Drive.File[] {
        const fileItelator = DriveApp.getFolderById(query.parentFolderId.id).getFiles();

        let founds = [];
        while (fileItelator.hasNext()) {
            const file = fileItelator.next();
            if (query.fileName.name === file.getName()) {
                founds.push(file);
            }
        }

        return founds;
    }

    static findFileById(query: FileIdQuery): GoogleAppsScript.Drive.File[] {
        const fileItelator = DriveApp.getFolderById(query.parentFolderId.id).getFiles();

        let founds = [];
        while (fileItelator.hasNext()) {
            const file = fileItelator.next();
            const id = file.getId();
            if (query.ids.some(fileId => fileId.id === id)) {
                founds.push(file);
            }
        }

        return founds;
    }

    static findFileDataById(query: FileIdQuery): GoogleAppsScript.Base.Blob[] {
        const fileItelator = DriveApp.getFolderById(query.parentFolderId.id).getFiles();

        let founds = [];
        while (fileItelator.hasNext()) {
            const file = fileItelator.next();
            const id = file.getId();
            if (query.ids.some(fileId => fileId.id === id)) {
                founds.push(file.getBlob());
            }
        }

        return founds;
    }

    static uploadFile(data: UploadData): GoogleAppsScript.Drive_v3.Drive.V3.Schema.File {
        if (data.fileId !== null) {
            const fileMetadata: GoogleAppsScript.Drive_v3.Drive.V3.Schema.File = {
                name: data.fileName.name,
                mimeType: data.mimeType.toString(),
            };
            return Drive.Files.update(fileMetadata, data.fileId.id, data.blob);
        }

        const fileMetadata: GoogleAppsScript.Drive_v3.Drive.V3.Schema.File = {
            name: data.fileName.name,
            mimeType: data.mimeType.toString(),
            parents: [data.parentFolderId.id]
        };
        return Drive.Files.create(fileMetadata, data.blob);
    }

    static deleteObjects(targets: FileId[] | FolderId[]): boolean {
        if (targets.length === 0) return true;

        try {
            targets.forEach(fileId => Drive.Files.remove(fileId.id));
        } catch (e: any) {
            Logger.log(`[deleteObjects] ${e}`);
            return false;
        }

        return true;
    }
}