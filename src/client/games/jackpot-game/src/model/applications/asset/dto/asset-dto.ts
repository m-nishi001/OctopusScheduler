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
  private _dataUrlPromise?: Promise<string>;
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

  get dataUrl(): Promise<string> {
    if (this._dataUrl) {
      const p = Promise.resolve(this._dataUrl);
      try {
        (p as any).toString = () => this._dataUrl as string;
        (p as any)[Symbol.toPrimitive] = () => this._dataUrl as string;
      } catch {
        // ignore if environment doesn't allow Symbol assignment
      }
      return p;
    }
    if (this._dataUrlPromise) return this._dataUrlPromise;
    if (this.file) {
      this._dataUrlPromise = fileToDataUrl(this.file).then((url) => {
        this._dataUrl = url;
        return url;
      });
      return this._dataUrlPromise;
    }
    const p = Promise.resolve(this._dataUrl || "");
    try {
      (p as any).toString = () => this._dataUrl || "";
      (p as any)[Symbol.toPrimitive] = () => this._dataUrl || "";
    } catch {
      // ignore
    }
    return p;
  }

  async toAsset(): Promise<Asset> {
    const dataUrl = await this.dataUrl;
    return {
      id: this.id,
      type: this.type,
      dataUrl,
      name: this.name,
      uploadedAt: this.uploadedAt,
      lastUpdated: this.lastUpdated,
      size: this.size,
    };
  }
}
