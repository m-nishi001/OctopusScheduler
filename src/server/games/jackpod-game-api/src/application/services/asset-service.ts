
import { injectable, inject } from "tsyringe";
import { GasService } from "./gas-service";
import { AssetRepositoryImpl, AssetRepositoryImplStatic } from "../../infrastructure/repositories/asset-repository";
import { Asset } from '../../domain/entities/asset';
import { AssetRepository as DomainAssetRepository } from '../../domain/repositories/asset-repository';

@injectable()
export class AssetService implements GasService {
    readonly serviceName = "AssetService";
    readonly functions: Record<string, (args: any) => any>;
    private domainRepository: DomainAssetRepository;

    constructor(
        @inject("IAssetRepository") private repository: AssetRepositoryImpl,
        @inject("IDomainAssetRepository") domainRepository?: DomainAssetRepository
    ) {
        this.domainRepository = domainRepository ?? repository;
        this.functions = {
            uploadAsset: this.uploadAsset.bind(this),
            deleteAsset: this.deleteAsset.bind(this),
            getAssetById: this.getAssetById.bind(this),
            listAssets: this.listAssets.bind(this),
            uploadDomainAsset: this.uploadDomainAsset.bind(this),
            getDomainAsset: this.getDomainAsset.bind(this)
        };
    }

    // GAS API用
    uploadAsset(args: { fileName: string; mimeType: string; dataUrl: string }): { assetId: string } {
        const blob = AssetRepositoryImplStatic.convertToBlobFromDataUrl(args.dataUrl, args.fileName, args.mimeType);
        const assetId = AssetRepositoryImplStatic.uploadAsset(args.fileName, args.mimeType, blob);
        return { assetId };
    }

    deleteAsset(args: { assetId: string }): { success: boolean } {
        AssetRepositoryImplStatic.deleteAsset(args.assetId);
        return { success: true };
    }

    getAssetById(args: { assetId: string }): GoogleAppsScript.Drive.File | null {
        return AssetRepositoryImplStatic.getAssetById(args.assetId);
    }

    listAssets(): GoogleAppsScript.Drive.File[] {
        return AssetRepositoryImplStatic.listAssets();
    }

    // ドメイン用
    async uploadDomainAsset(asset: Asset): Promise<string> {
        return await this.domainRepository.uploadAsset(asset);
    }

    async getDomainAsset(id: string): Promise<Asset | null> {
        return await this.domainRepository.getAsset(id);
    }
}
