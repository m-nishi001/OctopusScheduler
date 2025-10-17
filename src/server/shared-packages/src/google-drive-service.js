class DataSize {
    constructor(value, unit) {
        Object.defineProperty(this, "bytes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        switch (unit) {
            case "B":
                this.bytes = value;
                break;
            case "KB":
                this.bytes = value * DataSize.BYTES_IN_KB;
                break;
            case "MB":
                this.bytes = value * DataSize.BYTES_IN_MB;
                break;
            case "GB":
                this.bytes = value * DataSize.BYTES_IN_GB;
                break;
            default:
                this.bytes = value;
                break;
        }
    }
    toBytes() {
        return this.bytes;
    }
}
Object.defineProperty(DataSize, "BYTES_IN_KB", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 1024
});
Object.defineProperty(DataSize, "BYTES_IN_MB", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 1024 * DataSize.BYTES_IN_KB
});
Object.defineProperty(DataSize, "BYTES_IN_GB", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 1024 * DataSize.BYTES_IN_MB
});
class FileId {
    constructor(id) {
        Object.defineProperty(this, "id", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.id = id;
    }
    static create(id) {
        if (!id || id === "") {
            Logger.log(`[FileId] ID is invalid. Input value is ${id}`);
            return null;
        }
        return new FileId(id);
    }
}
class FileName {
    constructor(name) {
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = name;
    }
    static create(name) {
        if (!name || name === "") {
            Logger.log(`[FileName] Name is invalid. Input value is ${name}`);
            return null;
        }
        return new FileName(name);
    }
}
class FileMimeType {
    constructor(mimeType) {
        Object.defineProperty(this, "value", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.value = mimeType;
    }
    static create(rawMimeType) {
        if (typeof rawMimeType !== "string" || rawMimeType.trim() === "") {
            Logger.log("Error: MIME type must be a non-empty string.");
            return null;
        }
        const normalizedMimeType = FileMimeType.normalize(rawMimeType.trim().toLowerCase());
        return new FileMimeType(normalizedMimeType);
    }
    static normalize(mimeType) {
        return FileMimeType.normalizationMap.get(mimeType) || mimeType;
    }
    toString() {
        return this.value;
    }
    getValue() {
        return this.value;
    }
}
Object.defineProperty(FileMimeType, "normalizationMap", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: new Map([
        ["jpeg", "image/jpeg"],
        ["jpg", "image/jpeg"],
        ["image", "image/jpeg"],
        ["txt", "text/plain"],
        ["text", "text/plain"],
        ["html", "text/html"],
        ["json", "application/json"],
        ["pdf", "application/pdf"],
        ["csv", "text/csv"],
        ["xml", "application/xml"],
        ["zip", "application/zip"],
        ["javascript", "application/javascript"],
        ["js", "application/javascript"],
        ["css", "text/css"],
        [
            "doc",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        [
            "docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        [
            "xls",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
        [
            "xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
        [
            "ppt",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ],
        [
            "pptx",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ],
        ["googledocs", "application/vnd.google-apps.document"],
        ["gdoc", "application/vnd.google-apps.document"],
        ["googlesheets", "application/vnd.google-apps.spreadsheet"],
        ["gsheet", "application/vnd.google-apps.spreadsheet"],
        ["googleslides", "application/vnd.google-apps.presentation"],
        ["gslide", "application/vnd.google-apps.presentation"],
    ])
});
class FolderId {
    constructor(id) {
        Object.defineProperty(this, "id", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.id = id;
    }
    static create(id) {
        if (!id || id === "") {
            Logger.log(`[FolderId] ID is invalid. Input value is ${id}`);
            return null;
        }
        return new FolderId(id);
    }
}
class FileSearchService {
    static findFileByName(options) {
        const fileName = FileName.create(options.fileName);
        const parentFolderId = FolderId.create(options.parentFolderId);
        if (!fileName || !parentFolderId) {
            Logger.log("Error: Invalid file name or folder ID.");
            return [];
        }
        try {
            const folder = DriveApp.getFolderById(parentFolderId.id);
            const fileIterator = folder.getFilesByName(fileName.name);
            const founds = [];
            while (fileIterator.hasNext()) {
                founds.push(fileIterator.next());
            }
            return founds;
        }
        catch (e) {
            Logger.log(`[findFileByName] ${e}`);
            return [];
        }
    }
    static findFileByIds(options) {
        if (!options.fileIds || options.fileIds.length === 0) {
            Logger.log("Error: File IDs array is empty.");
            return [];
        }
        try {
            const founds = [];
            const fileIdSet = new Set(options.fileIds);
            fileIdSet.forEach((fileId) => {
                try {
                    const file = DriveApp.getFileById(fileId);
                    founds.push(file);
                }
                catch (e) {
                    Logger.log(`[findFileByIds] File with ID ${fileId} not found or access denied.`);
                }
            });
            return founds;
        }
        catch (e) {
            Logger.log(`[findFileByIds] ${e}`);
            return [];
        }
    }
    static findFileDataByIds(options) {
        const files = this.findFileByIds(options);
        return files.map((file) => file.getBlob());
    }
}
class FileUploadService {
    static uploadFile(options) {
        const fileId = options.fileId ? FileId.create(options.fileId) : null;
        const fileName = FileName.create(options.fileName);
        const parentFolderId = FolderId.create(options.parentFolderId);
        const mimeType = FileMimeType.create(options.mimeType);
        if (!fileName || !parentFolderId || !mimeType) {
            Logger.log("Error: Invalid upload options.");
            return null;
        }
        const fileMetadata = {
            name: fileName.name,
            mimeType: mimeType.toString(),
            parents: [parentFolderId.id],
        };
        try {
            if (fileId) {
                try {
                    DriveApp.getFileById(fileId.id);
                    const updateMetadata = {
                        name: fileName.name,
                        mimeType: mimeType.toString(),
                    };
                    return Drive.Files.update(updateMetadata, fileId.id, options.blob);
                }
                catch (e) {
                    Logger.log(`[uploadFile] Failed to update file with ID ${fileId.id}: ${e}`);
                    return Drive.Files.create(fileMetadata, options.blob);
                }
            }
            else {
                return Drive.Files.create(fileMetadata, options.blob);
            }
        }
        catch (e) {
            Logger.log(`[uploadFile] ${e}`);
            return null;
        }
    }
}
class FileDeleteService {
    static deleteFilesOrFolders(ids) {
        if (ids.length === 0)
            return true;
        try {
            ids.forEach((id) => {
                const fileId = FileId.create(id);
                if (fileId) {
                    Drive.Files.remove(fileId.id);
                }
            });
            return true;
        }
        catch (e) {
            Logger.log(`[deleteFilesOrFolders] ${e}`);
            return false;
        }
    }
}
class ZipService {
    static readyZipping(options) {
        const folderId = FolderId.create(options.folderId);
        const partationDataSize = new DataSize(options.partitionSizeInBytes, "B");
        if (!folderId || partationDataSize.toBytes() <= 0) {
            Logger.log(`[readyZipping] Invalid folder ID or partition size.`);
            return 0;
        }
        try {
            const folder = DriveApp.getFolderById(folderId.id);
            const fileIterator = folder.getFiles();
            let totalFileSize = 0;
            const fileSet = [[]];
            while (fileIterator.hasNext()) {
                const file = fileIterator.next();
                if (file.getMimeType() === MimeType.ZIP ||
                    file.getName() === ZipService.ZIP_READY_CONFIG_FILE_NAME) {
                    file.setTrashed(true);
                    continue;
                }
                const fileSize = file.getSize();
                if (partationDataSize.toBytes() < totalFileSize + fileSize) {
                    fileSet.push([]);
                    totalFileSize = 0;
                }
                fileSet[fileSet.length - 1].push(FileId.create(file.getId()));
                totalFileSize += fileSize;
            }
            folder.createFile(ZipService.ZIP_READY_CONFIG_FILE_NAME, JSON.stringify(fileSet.filter((set) => set.length > 0)), MimeType.PLAIN_TEXT);
            return fileSet.length;
        }
        catch (e) {
            Logger.log(`[readyZipping] ${e}`);
            return 0;
        }
    }
    static zip(options) {
        const folderId = FolderId.create(options.folderId);
        if (!folderId || options.sequence < 0) {
            Logger.log(`[zip] Invalid folder ID or sequence number.`);
            return false;
        }
        try {
            const folder = DriveApp.getFolderById(folderId.id);
            const foundFiles = folder.getFilesByName(ZipService.ZIP_READY_CONFIG_FILE_NAME);
            if (!foundFiles.hasNext()) {
                Logger.log(`[zip] ${ZipService.ZIP_READY_CONFIG_FILE_NAME} is not found. Must call "readyZipping" before calling this.`);
                return false;
            }
            const configOrigin = foundFiles.next().getBlob().getDataAsString();
            const configs = JSON.parse(configOrigin);
            const targetFileIds = configs[options.sequence];
            if (!targetFileIds) {
                Logger.log(`[zip] Sequence number ${options.sequence} is out of bounds.`);
                return false;
            }
            const targetBlobs = [];
            targetFileIds.forEach((fileId) => {
                try {
                    const file = DriveApp.getFileById(fileId.id);
                    targetBlobs.push(file.getBlob());
                }
                catch (e) {
                    Logger.log(`[zip] Error getting file with ID ${fileId.id}: ${e}`);
                }
            });
            if (targetBlobs.length !== targetFileIds.length) {
                Logger.log(`[zip] Some target files were not found.`);
                return false;
            }
            const zip = Utilities.zip(targetBlobs, `${folder.getName()}_zip_${options.sequence}.zip`);
            folder.createFile(zip);
            return true;
        }
        catch (e) {
            Logger.log(`[zip] ${e}`);
            return false;
        }
    }
}
Object.defineProperty(ZipService, "ZIP_READY_CONFIG_FILE_NAME", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: "zip-ready-config.json"
});
export class GoogleDriveService {
    static findFileByName(options) {
        return FileSearchService.findFileByName(options);
    }
    static findFileByIds(options) {
        return FileSearchService.findFileByIds(options);
    }
    static findFileDataByIds(options) {
        return FileSearchService.findFileDataByIds(options);
    }
    static uploadFile(options) {
        return FileUploadService.uploadFile(options);
    }
    static deleteFilesOrFolders(ids) {
        return FileDeleteService.deleteFilesOrFolders(ids);
    }
    static readyZipping(options) {
        return ZipService.readyZipping(options);
    }
    static zip(options) {
        return ZipService.zip(options);
    }
}
