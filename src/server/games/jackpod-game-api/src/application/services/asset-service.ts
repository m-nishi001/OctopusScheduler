import { injectable, inject } from "tsyringe";
import { GasService } from "./gas-service";
import { AssetRepositoryImpl, AssetRepositoryImplStatic } from "../../infrastructure/repositories/asset-repository";
import { AssetRepository as DomainAssetRepository } from '../../domain/repositories/asset-repository';
import { AssetDto } from '../dtos/asset-dto';

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
    uploadDomainAsset(assetDto: AssetDto): string {
        // DTO→Entity変換
        const assetEntity = this.toAssetEntity(assetDto);
        return this.domainRepository.uploadAsset(assetEntity);
    }

    getDomainAsset(id: string): AssetDto | null {
        // Entity→DTO変換
        const assetEntity = this.domainRepository.getAsset(id);
        return assetEntity ? this.toAssetDto(assetEntity) : null;
    }

    /**
     * DTO→Entity変換
     */
    private toAssetEntity(dto: AssetDto): any {
        // AssetEntity型が明確なら型を指定
        return {
            id: dto.id,
            type: dto.type,
            url: dto.url,
            name: dto.name,
            uploadedAt: dto.uploadedAt,
            size: dto.size,
            meta: dto.meta ?? {}
        };
    }

    /**
     * Entity→DTO変換
     */
    private toAssetDto(entity: any): AssetDto {
        return {
            id: entity.id,
            type: entity.type,
            url: entity.url,
            name: entity.name,
            uploadedAt: entity.uploadedAt,
            size: entity.size,
            meta: entity.meta ?? {}
        };
    }
}
