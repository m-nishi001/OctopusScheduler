export class AssetMetadataDto {
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

export class AssetDataDto {
  id: string;
  type: string;
  name: string;
  uploadedAt: Date;
  lastUpdated: Date;
  size: number;
  blob: Blob;

  constructor(entity: any) {
    this.id = entity?.metadata?.driveDataId ?? "";
    this.type = entity?.fileKind ?? "";
    this.name = entity?.fileName ?? "";
    this.uploadedAt = entity?.uploadDate ?? new Date();
    this.lastUpdated = entity?.metadata?.lastUpdate ?? new Date();
    this.size = entity?.metadata?.size ?? 0;
    // Ensure blob is always present. If repository provided a Blob use it,
    // otherwise create an empty Blob so the type is always satisfied.
    if (entity?.blob) {
      this.blob = entity.blob;
    } else {
      this.blob = new Blob();
    }
  }

  async toDriveData(): Promise<any> {
    return {
      metadata: {
        driveDataId: this.id,
        fileId: "",
        parentFolderId: "",
        lastUpdate: this.lastUpdated,
        size: this.size,
      },
      fileName: this.name,
      fileKind: this.type,
      // blob-only DTO no longer exposes a fileDataUrl here
      fileDataUrl: "",
      uploadDate: this.uploadedAt,
      parentFolderId: "",
    };
  }
}
