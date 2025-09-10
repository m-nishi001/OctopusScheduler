import { AssetType } from "../vo/asset-type";

export class Asset {
    readonly assetId: string;
    readonly assetType: AssetType;

    private _assetName: string;
    private _assetData: GoogleAppsScript.Base.Blob;
    private _updatedAt: Date;

    private constructor(
        assetId: string,
        assetName: string,
        assetType: AssetType,
        assetData: GoogleAppsScript.Base.Blob,
        updatedAt: Date
    ) {
        this.assetId = assetId;
        this.assetType = assetType;
        this._assetName = assetName;
        this._assetData = assetData;
        this._updatedAt = updatedAt;
    }

    static createFrom(source: Asset): Asset {
        return new Asset(
            source.assetId,
            source.assetName,
            source.assetType,
            source.assetData,
            new Date(source.updatedAt)
        );
    }

    static createFromClient(source: Asset): Asset {
        return new Asset(
            source.assetId,
            source.assetName,
            source.assetType,
            
            // クライアント側から送られてくる assetData は data URL 形式であるため、Blob に変換する
            this.convertToBlobFromDataUrl(source.assetData as unknown as string, source.assetName),
            
            new Date(source.updatedAt)
        );
    }

    serializeForClient(): Asset {
        // クライアント側に送る際は assetData を data URL 形式に変換する
        // プロパティの型を合わせるために unknown 経由でキャストしている（プロパティだけ合っていれば良い。）
        return {
            assetId: this.assetId,
            assetName: this._assetName,
            assetType: this.assetType,
            assetData: Asset.convertToDataUrlFromBlob(this._assetData),
            updatedAt: this._updatedAt
        } as unknown as Asset;
    }

    updateAssetName(newName: string): void {
        this._assetName = newName;
    }

    get assetName(): string {
        return this._assetName;
    }

    get assetData(): GoogleAppsScript.Base.Blob {
        return this._assetData;
    }

    get updatedAt(): Date {
        return this._updatedAt;
    }

    private static convertToBlobFromDataUrl(dataUrl: string, assetName: string): GoogleAppsScript.Base.Blob {
        const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);

        if (!matches || matches.length !== 3) throw new Error("Invalid data URL format.");

        const mimeType = matches[1];
        const base64Data = matches[2];
        const decodedData = Utilities.base64Decode(base64Data);
        return Utilities.newBlob(decodedData, mimeType, assetName);
    }

    private static convertToDataUrlFromBlob(blob: GoogleAppsScript.Base.Blob): string {
        const base64Data = Utilities.base64Encode(blob.getBytes());
        return `data:${blob.getContentType()};base64,${base64Data}`;
    }
}