/**
 * @file AssetApplicationService.ts
 * @description メディア資産（Asset）に関するユースケースを実装します。
 * 【修正】永続化に関する詳細なロジックはAssetRepositoryにカプセル化されました。
 * このサービスは、ビジネスルールの検証と、リポジトリへの処理の委譲に責務を集中します。
 */

import { AssetRepository } from './AssetRepository';
import type { AssetDto, AssetData } from './Asset';

/**
 * クライアントからアセットをアップロードする際に使用するペイロードの型。
 */
export type UploadAssetPayload = {
    assetName: string;
    assetType: 'se' | 'bgm' | 'image' | 'other';
    base64Data: string;
    mimeType: string;
    description: string;
};

/**
 * メディア資産に関するユースケースを実現するサービスクラス。
 */
export class AssetApplicationService {
    /**
     * 【修正】依存をAssetRepositoryに一本化。
     * AssetStorageServiceへの直接の依存はなくなりました。
     */
    private readonly assetRepository: AssetRepository;

    constructor() {
        this.assetRepository = new AssetRepository();
    }

    /**
     * ユースケース: 登録されている全てのアセットのメタデータを取得します。
     * @returns AssetDtoの配列
     */
    public getAssetList(): AssetDto[] {
        return this.assetRepository.findAll();
    }

    /**
     * ユースケース: 指定されたアセット名のリストに基づき、ファイル本体(Blob)を取得します。
     * @param assetNames - 取得したいアセット名の配列
     * @returns クライアント転送用のアセットデータ(AssetData)の配列
     */
    public getAssetBlobs(assetNames: string[]): AssetData[] {
        const allAssets = this.assetRepository.findAll();
        const requestedAssets = allAssets.filter(asset => assetNames.includes(asset.name));
        const assetDataList: AssetData[] = [];

        for (const asset of requestedAssets) {
            try {
                const fileBlob = DriveApp.getFileById(asset.driveFileId).getBlob();
                const base64Data = Utilities.base64Encode(fileBlob.getBytes());

                const mimeType = fileBlob.getContentType() || 'application/octet-stream';

                assetDataList.push({
                    dataId: asset.name,
                    dataType: asset.assetType,
                    name: asset.name,
                    mimeType: mimeType,
                    dataBody: base64Data,
                    updatedAt: asset.updatedAt,
                });
            } catch (e) {
                console.error(`Failed to retrieve blob for asset: ${asset.name} (Drive ID: ${asset.driveFileId}). Error: ${(e as Error).message}`);
            }
        }
        return assetDataList;
    }

    /**
     * ユースケース: 新しいメディア資産をアップロードします。
     * 【修正】永続化処理をAssetRepositoryに完全に委譲しました。
     * @param payload - クライアントから渡されたアップロード情報
     * @returns 保存されたアセットのIDとDriveファイルID
     */
    public uploadAsset(payload: UploadAssetPayload): { id: string; driveFileId: string; } {
        // ビジネスルール：同じ名前のアセットは存在できない
        const existingAssets = this.assetRepository.findAll();
        if (existingAssets.some(asset => asset.name === payload.assetName)) {
            throw new Error(`An asset with the name "${payload.assetName}" already exists.`);
        }

        // 永続化の依頼はリポジトリに一度行うだけ
        const savedAsset = this.assetRepository.save(payload);

        return {
            id: savedAsset.id,
            driveFileId: savedAsset.driveFileId,
        };
    }

    /**
     * ユースケース: アセットを削除します。
     * 【修正】永続化処理をAssetRepositoryに委譲しました。
     * @param assetId - 削除するアセットのID
     */
    public deleteAsset(assetId: string): void {
        this.assetRepository.delete(assetId);
    }
}
