import { Asset } from "../entity/assset";
import type { IAssetType } from "./asset-type";

export class AudioType implements IAssetType {

    readonly assetTypeName: string = "audio";

    create(): Asset {
        return Asset.create(this);
    }

}