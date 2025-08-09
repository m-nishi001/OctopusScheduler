export class DataSize {
    private readonly bytes: number;
    private static readonly BYTES_IN_KB = 1024;
    private static readonly BYTES_IN_MB = 1024 * DataSize.BYTES_IN_KB;
    private static readonly BYTES_IN_GB = 1024 * DataSize.BYTES_IN_MB;

    constructor(value: number | DataSize, unit?: 'B' | 'KB' | 'MB' | 'GB') {
        if (value instanceof DataSize) { this.bytes = value.bytes; return; }
        if (typeof value === 'number') {
            switch (unit) {
                case 'B': this.bytes = value; break;
                case 'KB': this.bytes = value * DataSize.BYTES_IN_KB; break;
                case 'MB': this.bytes = value * DataSize.BYTES_IN_MB; break;
                case 'GB': this.bytes = value * DataSize.BYTES_IN_GB; break;
                default: this.bytes = value; break;
            }
        } else {
            throw new Error('無効なコンストラクタ引数です。');
        }
    }

    public toBytes(): number { return this.bytes; }
    public toKilobytes(): number { return this.bytes / DataSize.BYTES_IN_KB; }
    public toMegabytes(): number { return this.bytes / DataSize.BYTES_IN_MB; }
    public toGigabytes(): number { return this.bytes / DataSize.BYTES_IN_GB; }

    public equals(other: DataSize): boolean { return this.bytes === other.bytes; }

    public toString(unit: 'B' | 'KB' | 'MB' | 'GB' = 'B', fractionDigits: number = 2): string {
        let value: number; let unitString: string;
        switch (unit) {
            case 'B': value = this.toBytes(); unitString = 'B'; break;
            case 'KB': value = this.toKilobytes(); unitString = 'KB'; break;
            case 'MB': value = this.toMegabytes(); unitString = 'MB'; break;
            case 'GB': value = this.toGigabytes(); unitString = 'GB'; break;
            default: value = this.toBytes(); unitString = 'B'; break;
        }
        return `${value.toFixed(fractionDigits)}${unitString}`;
    }
}

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

export class FileId {
    public readonly id: string;

    private constructor(id: string) {
        this.id = id;
    }

    static create(id: string): FileId | null {
        if (!id || id === "") {
            Logger.log(`[FileId] name was invalid. Input value is ${id}`);
            return null;
        }
        return new FileId(id);
    }
}

export class FileMimeType {
    private readonly value: string;

    private static normalizationMap = new Map([
        ['jpeg', 'image/jpeg'],
        ['jpg', 'image/jpeg'],
        ['image', 'image/jpeg'],
        ['txt', 'text/plain'],
        ['text', 'text/plain'],
        ['html', 'text/html'],
        ['json', 'application/json'],
        ['pdf', 'application/pdf'],
        ['csv', 'text/csv'],
        ['xml', 'application/xml'],
        ['zip', 'application/zip'],
        ['javascript', 'application/javascript'],
        ['js', 'application/javascript'],
        ['css', 'text/css'],
        ['doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        ['xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        ['ppt', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        ['googledocs', 'application/vnd.google-apps.document'],
        ['gdoc', 'application/vnd.google-apps.document'],
        ['googlesheets', 'application/vnd.google-apps.spreadsheet'],
        ['gsheet', 'application/vnd.google-apps.spreadsheet'],
        ['googleslides', 'application/vnd.google-apps.presentation'],
        ['gslide', 'application/vnd.google-apps.presentation']
    ]);

    private constructor(mimeType: string) {
        this.value = mimeType;
    }

    static create(rawMimeType: string) {
        if (typeof rawMimeType !== 'string' || rawMimeType.trim() === '') {
            Logger.log('Error: MIMEタイプは空でない文字列である必要があります。');
            return null;
        }

        const normalizedMimeType = FileMimeType.normalize(rawMimeType.trim().toLowerCase());

        if (!FileMimeType.isValid(normalizedMimeType)) {
            Logger.log(`Error: 不正なMIMEタイプが指定されました: "${rawMimeType}" (正規化後: "${normalizedMimeType}")`);
            return null;
        }

        return new FileMimeType(normalizedMimeType);
    }

    private static normalize(mimeType: string) {
        return FileMimeType.normalizationMap.get(mimeType) || mimeType;
    }

    private static isValid(mimeType: string) {
        const mimeTypePattern = /^[a-zA-Z0-9\-\.]+\/[a-zA-Z0-9\-\.\+]+$/;
        if (mimeTypePattern.test(mimeType)) {
            return true;
        }

        const googleMimeTypes = [
            'application/vnd.google-apps.document',
            'application/vnd.google-apps.spreadsheet',
            'application/vnd.google-apps.presentation',
            'application/vnd.google-apps.drawing',
            'application/vnd.google-apps.script',
            'application/vnd.google-apps.folder',
            'application/vnd.google-apps.form',
            'application/vnd.google-apps.site',
            'application/vnd.google-apps.map',
            'application/vnd.google-apps.fusiontable',
            'application/vnd.google-apps.script-json',
            'application/vnd.google-apps.shortcut'
        ];
        if (googleMimeTypes.includes(mimeType)) {
            return true;
        }

        const commonMimeTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp',
            'text/plain', 'text/html', 'text/css', 'text/csv',
            'application/json', 'application/pdf', 'application/xml', 'application/zip',
            'application/javascript',
            'audio/mpeg', 'audio/wav',
            'video/mp4', 'video/webm'
        ];
        if (commonMimeTypes.includes(mimeType)) {
            return true;
        }

        return false;
    }

    toString() {
        return this.value;
    }

    getValue() {
        return this.value;
    }
}

export interface FileNameQuery {
    readonly fileName: FileName;
    readonly parentFolderId: FolderId;
}

export class FileName {
    public readonly name: string;

    private constructor(name: string) {
        this.name = name;
    }

    static create(name: string): FileName | null {
        if (!name || name === "") {
            Logger.log(`[FileName] name was invalid. Input value is ${name}`);
            return null;
        }
        return new FileName(name);
    }
}

export class FolderId {
    public readonly id: string;

    private constructor(id: string) {
        this.id = id;
    }

    static create(id: string): FolderId | null {
        if (!id || id === "") {
            Logger.log(`[FolderId] name was invalid. Input value is ${id}`);
            return null;
        }
        return new FolderId(id);
    }
}

export interface UploadData {
    readonly fileId: FileId | null;
    readonly fileName: FileName;
    readonly parentFolderId: FolderId;
    readonly mimeType: FileMimeType;
    readonly blob: GoogleAppsScript.Base.Blob;
}

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