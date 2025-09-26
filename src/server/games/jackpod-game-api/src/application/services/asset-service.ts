import { injectable, inject } from "tsyringe";
import { GasService } from "./gas-service";
import { AssetRepository } from "../../infrastructure/repositories/asset-repository";

@injectable()
export class AssetService implements GasService {
    readonly serviceName = "AssetService";
    readonly functions: Record<string, (args: any) => any>;

    constructor(@inject("IAssetRepository") private repository: AssetRepository) {
        this.functions = {
            uploadAsset: this.uploadAsset.bind(this),
            deleteAsset: this.deleteAsset.bind(this),
            getAssetById: this.getAssetById.bind(this),
            listAssets: this.listAssets.bind(this)
        };
    }

    uploadAsset(args: { fileName: string; mimeType: string; dataUrl: string }): { assetId: string } {
        const blob = AssetRepository.convertToBlobFromDataUrl(args.dataUrl, args.fileName, args.mimeType);
        const assetId = AssetRepository.uploadAsset(args.fileName, args.mimeType, blob);
        return { assetId };
    }

    deleteAsset(args: { assetId: string }): { success: boolean } {
        AssetRepository.deleteAsset(args.assetId);
        return { success: true };
    }

    getAssetById(args: { assetId: string }): GoogleAppsScript.Drive.File | null {
        return AssetRepository.getAssetById(args.assetId);
    }

    listAssets(): GoogleAppsScript.Drive.File[] {
        return AssetRepository.listAssets();
    }
}
