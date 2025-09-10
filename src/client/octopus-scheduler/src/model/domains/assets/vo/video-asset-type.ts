import { Asset } from "../entity/assset";
import type { IAssetType } from "./asset-type";

export class VideoType implements IAssetType {

    readonly assetTypeName: string = "video";

    create(): Asset {
        return Asset.create(this);
    }

}