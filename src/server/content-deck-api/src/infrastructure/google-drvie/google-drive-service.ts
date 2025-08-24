import { DataSize } from "./value-object/data-size";
import { FileId } from "./value-object/file-id";
import { FileIdQuery } from "./value-object/file-id-query";
import { FileNameQuery } from "./value-object/file-name-query";
import { FolderId } from "./value-object/folder-id";
import { UploadData } from "./value-object/upload-data";

export class GoogleDriveService {
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

    private static readonly ZIP_READY_CONFIG_FILE_NAME = "zip-ready-config.json";

    static readyZipping(target: FolderId, partationDataSize: DataSize): number {
        if (partationDataSize.toBytes() <= 0) {
            Logger.log(`[readyZipping] partationDataSize is invalid. the value is ${partationDataSize}`);
            return 0;
        }

        try {
            const folder = DriveApp.getFolderById(target.id);
            const fileItelator = folder.getFiles();

            let totalFileSize = 0;
            const fileSet: FileId[][] = [];
            while (fileItelator.hasNext()) {
                const file = fileItelator.next();

                if (file.getMimeType() === MimeType.ZIP || file.getName() === GoogleDriveService.ZIP_READY_CONFIG_FILE_NAME) {
                    file.setTrashed(true);
                    continue;
                }

                const fileSize = file.getSize();
                if (partationDataSize.toBytes() < totalFileSize + fileSize) {
                    fileSet.push([]);
                    totalFileSize = 0;
                }

                fileSet[fileSet.length - 1].push(FileId.create(file.getId())!);
                totalFileSize += fileSize;
            }

            folder.createFile(
                GoogleDriveService.ZIP_READY_CONFIG_FILE_NAME,
                JSON.stringify(fileSet),
                MimeType.PLAIN_TEXT);

            return fileSet.length;
        } catch (e: any) {
            Logger.log(`[readyZipping] ${e}`);
            return 0;
        }
    }

    static zip(target: FolderId, seq: number): boolean {
        if (seq < 0) {
            Logger.log(`[zip] seq is invalid. the number is ${seq}`);
            return false;
        }

        try {
            const folder = DriveApp.getFolderById(target.id);
            const foundFiles = folder.getFilesByName(GoogleDriveService.ZIP_READY_CONFIG_FILE_NAME)
            if (!foundFiles.hasNext()) {
                Logger.log(`[zip] ${GoogleDriveService.ZIP_READY_CONFIG_FILE_NAME} is not found. Must call "readyZipping" before calling this.`);
                return false;
            }

            const configOrigin = foundFiles.next().getBlob().getDataAsString();
            const configs = JSON.parse(configOrigin) as FileId[][];
            const targetFileIds = configs[seq];

            const fileItelator = folder.getFiles();
            const targetBlobs: GoogleAppsScript.Base.Blob[] = [];
            while (fileItelator.hasNext()) {
                const file = fileItelator.next();

                if (targetFileIds.some(fileId => fileId.id === file.getId())) {
                    targetBlobs.push(file.getBlob());
                }

                if (targetFileIds.length === targetBlobs.length) break;
            }

            const zip = Utilities.zip(targetBlobs, `${folder.getName()}_zip_${seq}.zip`);
            folder.createFile(zip);
            return true;
        } catch (e: any) {
            Logger.log(`[zip] ${e}`);
            return false;
        }
    }

}