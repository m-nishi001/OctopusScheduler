/**
 * @file AssetRepository.ts
 * @description
 * メディア資産（Asset）の永続化をRepositoryServiceを介して行います。
 * 【修正】このリポジトリは、アセットのメタデータ（スプレッドシート）と
 * ファイル本体（Google Drive）の両方の永続化を管理する責務を持ちます。
 */

import { RepositoryService } from '../../repository/RepositoryService';
import { AssetStorageService } from '../../repository/AssetStorageService';
import type { AssetDto } from './Asset';

const SHEET_NAME = 'assets';

export class AssetRepository {
    private readonly metaRepository: RepositoryService<AssetDto>;
    private readonly audioStorage: AssetStorageService;
    private readonly imageStorage: AssetStorageService;

    constructor() {
        this.metaRepository = new RepositoryService<AssetDto>(SHEET_NAME);
        this.audioStorage = new AssetStorageService('AUDIO_FOLDER_ID');
        this.imageStorage = new AssetStorageService('IMAGE_FOLDER_ID');
    }

    /**
     * IDでアセットのメタデータを検索します。
     * @param id - 検索するアセットのID
     * @returns 見つかった場合はAssetDto、見つからない場合はnull
     */
    public findById(id: string): AssetDto | null {
        return this.metaRepository.read(id);
    }

    /**
     * 全てのアセットのメタデータを取得します。
     * @returns AssetDtoの配列
     */
    public findAll(): AssetDto[] {
        return this.metaRepository.list();
    }

    /**
     * アセットを永続化（新規作成）します。
     * ファイル本体をGoogle Driveに保存し、その情報を含むメタデータをスプレッドシートに記録します。
     * @param assetToSave - 保存するアセットの情報を含むオブジェクト
     * @returns 永続化されたアセットのメタデータ (AssetDto)
     */
    public save(assetToSave: {
        assetName: string;
        assetType: 'se' | 'bgm' | 'image' | 'other';
        base64Data: string;
        mimeType: string;
        description: string;
    }): AssetDto {
        // アセットの種類に応じて、保存先のストレージサービスを選択
        const storageService = assetToSave.assetType === 'image' ? this.imageStorage : this.audioStorage;

        // 1. ファイル本体をGoogle Driveに保存し、そのIDを取得
        const driveFileId = storageService.save(
            assetToSave.assetName,
            assetToSave.mimeType,
            assetToSave.base64Data
        );

        // 2. スプレッドシートに保存するメタデータオブジェクトを作成
        const newAssetDto: AssetDto = {
            id: Utilities.getUuid(),
            name: assetToSave.assetName,
            assetType: assetToSave.assetType,
            driveFileId: driveFileId,
            mimeType: assetToSave.mimeType,
            updatedAt: new Date(),
            description: assetToSave.description,
        };

        // 3. メタデータをスプレッドシートに保存
        this.metaRepository.create(newAssetDto);

        return newAssetDto;
    }

    /**
     * アセットを削除します。
     * Google Drive上のファイル本体と、スプレッドシート上のメタデータの両方を削除します。
     * @param assetId - 削除するアセットのID
     */
    public delete(assetId: string): void {
        // 1. まずメタデータを読み込み、削除対象の情報を取得
        const assetToDelete = this.metaRepository.read(assetId);
        if (!assetToDelete) {
            console.warn(`Asset with ID ${assetId} not found. Deletion skipped.`);
            return;
        }

        // 2. アセットの種類に応じてストレージサービスを選択
        const storageService = assetToDelete.assetType === 'image' ? this.imageStorage : this.audioStorage;

        // 3. Google Driveからファイル本体を削除
        storageService.delete(assetToDelete.driveFileId);

        // 4. スプレッドシートからメタデータを削除
        this.metaRepository.delete(assetId);
    }
}
