export class AssetMetadata {

    readonly assetId: string;
    readonly assetName: string;
    readonly assetType: string;
    readonly assetSize: number;
    readonly createdAt: Date;
    readonly updatedAt: Date;

    constructor(
        assetId: string,
        assetName: string,
        assetType: string,
        assetSize: number,
        createdAt: Date,
        updatedAt: Date
    ) {
        this.assetId = assetId;
        this.assetName = assetName;
        this.assetType = assetType;
        this.assetSize = assetSize;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
}