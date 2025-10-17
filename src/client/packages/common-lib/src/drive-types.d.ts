export interface DriveData {
    metadata: DriveMetadata;
    fileName: string;
    fileKind: string;
    fileDataUrl: string;
    uploadDate: Date;
    parentFolderId: string;
}
export interface DriveMetadata {
    driveDataId: string;
    fileId: string;
    parentFolderId: string;
    lastUpdate: Date;
}
export interface OperationResult<T = void> {
    status: "success" | "duplicate" | "error";
    data?: T;
    message?: string;
}
//# sourceMappingURL=drive-types.d.ts.map