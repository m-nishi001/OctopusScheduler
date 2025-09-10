import { Asset } from "../entity/assset";
import type { IAssetType } from "./asset-type";

export class ImageType implements IAssetType {

    readonly assetTypeName: string = "image";

    create(): Asset {
        return Asset.create(this);
    }

}