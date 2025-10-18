import type { DriveData } from "../../../../../../../../server/common/src/drive-types";

export class DriveDataMetadataDto {
  id: string;
  type: string;
  name: string;
  uploadedAt: Date;
  lastUpdated: Date;
  size: number;

  constructor(
    id: string,
    type: string,
    name: string,
    uploadedAt: Date,
    lastUpdated: Date,
    size: number
  ) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.uploadedAt = uploadedAt;
    this.lastUpdated = lastUpdated;
    this.size = size;
  }
}

export class DriveDataDto {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly uploadedAt: Date;
  readonly lastUpdated: Date;
  readonly size: number;
  readonly dataUrl: string;
  readonly referenceFrom: string[];

  constructor(entity: DriveData) {
    this.id = entity.metadata.driveDataId;
    this.type = entity.fileKind;
    this.name = entity.fileName;
    this.uploadedAt = entity.uploadDate;
    this.lastUpdated = entity.metadata.lastUpdate;
    this.size = 0; // DriveData has no size
    this.dataUrl = entity.fileDataUrl;
    this.referenceFrom = []; // DriveData has no referenceFrom
  }

  async toDriveData(): Promise<DriveData> {
    return {
      metadata: {
        driveDataId: this.id,
        fileId: "",
        parentFolderId: "",
        lastUpdate: this.lastUpdated,
      },
      fileName: this.name,
      fileKind: this.type,
      fileDataUrl: this.dataUrl,
      uploadDate: this.uploadedAt,
      parentFolderId: "",
    };
  }
}
