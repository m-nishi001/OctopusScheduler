import { inject, injectable } from "tsyringe";
import { GasService } from "../gas-service";
import { Asset } from "../../domain/assets/entity/asset";
import { IAssetRepository } from "../../domain/assets/repository/asset-repository";
import { AssetMetadata } from "../../domain/assets/vo/asset-metadata";

@injectable()
export class AssetService implements GasService {

    readonly serviceName = "AssetService";
    readonly functions: Record<string, (args: any) => any>;

    constructor(@inject("IAssetRepository") private repository: IAssetRepository) {
        this.functions = {
            "addAsset": this.addAsset.bind(this),
            "getAssetById": this.getAssetById.bind(this),
            "updateName": this.updateName.bind(this),
            "deleteAsset": this.deleteAsset.bind(this),
            "getAllMetadatas": this.getAllMetadatas.bind(this)
        };
    }

    private addAsset(source: Asset): { assetId: string } {
        const entity = Asset.createFromClient(source);
        const assetId = this.repository.add(entity);
        return { assetId };
    }

    private getAssetById(assetId: string): Asset | null {
        const entity = this.repository.findById(assetId);
        return entity ? entity.serializeForClient() : null;
    }

    private updateName(args: { assetId: string, newName: string }): { assetId: string } {
        const entity = this.repository.findById(args.assetId);

        if (!entity) throw new Error(`Asset with ID ${args.assetId} not found.`);

        entity.updateAssetName(args.newName);
        this.repository.update(entity);

        return { assetId: entity.assetId };
    }

    private deleteAsset(assetId: string): { success: boolean } {
        this.repository.delete(assetId);
        return { success: true };
    }

    private getAllMetadatas(): {
        assetId: string;
        updatedAt: Date
    }[] {
        return this.repository.getAllMetadatas()
            .map((assetMetadata: AssetMetadata) => ({
                assetId: assetMetadata.assetId,
                updatedAt: assetMetadata.updatedAt
            }));
    }
}