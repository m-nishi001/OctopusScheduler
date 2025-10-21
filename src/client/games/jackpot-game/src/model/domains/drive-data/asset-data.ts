export class AssetMetadata {
  id: string;
  type: string;
  name: string;
  // Use ISO string for dates to make serialization deterministic
  uploadedAt: string;
  lastUpdated: string;
  size: number;

  constructor(
    id: string,
    type: string,
    name: string,
    uploadedAt: string,
    lastUpdated: string,
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
  // Store timestamps as ISO strings to avoid Date serialization issues
  uploadedAt: string;
  lastUpdated: string;
  size: number;
  blob: Blob;

  constructor(
    id: string,
    type: string,
    name: string,
    uploadedAt: string,
    lastUpdated: string,
    size: number,
    blob: Blob
  ) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.uploadedAt = uploadedAt;
    this.lastUpdated = lastUpdated;
    this.size = size;
    this.blob = blob;
  }
}
