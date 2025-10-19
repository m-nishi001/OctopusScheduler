export class AssetMetadata {
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

export class Asset {
  id: string;
  type: string;
  name: string;
  uploadedAt: Date;
  lastUpdated: Date;
  size: number;
  blob: Blob;

  constructor(
    id: string,
    type: string,
    name: string,
    uploadedAt: Date,
    lastUpdated: Date,
    size: number,
    blob: Blob
  ) {
    this.id = id ?? "";
    this.type = type ?? "";
    this.name = name ?? "";
    this.uploadedAt = uploadedAt ?? new Date();
    this.lastUpdated = lastUpdated ?? new Date();
    this.size = size ?? 0;
    this.blob = blob;
  }
}
