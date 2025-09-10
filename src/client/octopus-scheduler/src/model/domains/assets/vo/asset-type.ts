import type { Asset } from "../entity/assset";

export interface IAssetType {

    readonly assetTypeName: string;

    create(assetName: string): Asset;

}