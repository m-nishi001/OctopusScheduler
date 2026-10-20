/** 素材1件(画像・音声)。日時は ISO 文字列で持つ(保存・同期で Date が崩れないように)。 */
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
