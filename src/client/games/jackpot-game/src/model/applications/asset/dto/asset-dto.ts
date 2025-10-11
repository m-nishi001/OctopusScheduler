import type { Asset } from "../../../domains/asset/asset";

const getAssetType = (
  mimeType: string
): "image" | "video" | "audio" | "text" => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "text";
};

const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export class AssetMetadataDto {
  id: string;
  type: "image" | "video" | "audio" | "text";
  name: string;
  uploadedAt: string;
  lastUpdated: string;
  size: number;

  constructor(
    id: string,
    type: "image" | "video" | "audio" | "text",
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

export class AssetDto extends AssetMetadataDto {
  private _dataUrl?: string;
  private file?: File;

  constructor(file: File);
  constructor(entity: {
    id: string;
    type: "image" | "video" | "audio" | "text";
    dataUrl: string;
    name: string;
    uploadedAt: string;
    lastUpdated: string;
    size: number;
  });
  constructor(
    arg:
      | File
      | {
          id: string;
          type: "image" | "video" | "audio" | "text";
          dataUrl: string;
          name: string;
          uploadedAt: string;
          lastUpdated: string;
          size: number;
        }
  ) {
    if (arg instanceof File) {
      super(
        "",
        getAssetType(arg.type),
        arg.name,
        new Date().toISOString(),
        new Date().toISOString(),
        arg.size
      );
      this._dataUrl = undefined;
      this.file = arg;
    } else {
      super(
        arg.id,
        arg.type,
        arg.name,
        arg.uploadedAt,
        arg.lastUpdated,
        arg.size
      );
      this._dataUrl = arg.dataUrl;
    }
  }

  get dataUrl(): string | undefined {
    return this._dataUrl;
  }

  async loadDataUrl(): Promise<void> {
    if (this._dataUrl) return;
    if (this.file) {
      this._dataUrl = await fileToDataUrl(this.file);
    }
  }

  async toAsset(): Promise<Asset> {
    await this.loadDataUrl();
    return {
      id: this.id,
      type: this.type,
      dataUrl: this._dataUrl || "",
      name: this.name,
      uploadedAt: this.uploadedAt,
      lastUpdated: this.lastUpdated,
      size: this.size,
    };
  }
}
