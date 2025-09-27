
import { Asset } from '../../domain/entities/asset';
import type { AssetRepository as IAssetRepository } from '../../domain/repositories/asset-repository';
import { GoogleDriveService } from "../../../../../shared-packages/src/google-drive-service";

const ASSET_FOLDER_ID = 'YOUR_ASSET_FOLDER_ID'; // TODO: Set actual folder ID

export class AssetRepositoryImpl implements IAssetRepository {
    async uploadAsset(asset: Asset): Promise<string> {
        // asset.url is assumed to be a dataUrl
        const blob = AssetRepositoryImplStatic.convertToBlobFromDataUrl(asset.url, asset.name, asset.type);
        const file = GoogleDriveService.uploadFile({
            fileName: asset.name,
            parentFolderId: ASSET_FOLDER_ID,
            mimeType: asset.type,
            blob: blob
        });
        return file ? file.id || '' : '';
    }

    async getAsset(id: string): Promise<Asset | null> {
        const files = GoogleDriveService.findFileByIds({ fileIds: [id], parentFolderId: ASSET_FOLDER_ID });
        if (files.length === 0) return null;
        const file = files[0];
        // Map mimeType to Asset.type
        let type: 'image' | 'video' | 'audio' | 'text' = 'text';
        const mimeType = file.getMimeType();
        if (mimeType.startsWith('image/')) type = 'image';
        else if (mimeType.startsWith('video/')) type = 'video';
        else if (mimeType.startsWith('audio/')) type = 'audio';
        else type = 'text';
        return {
            id: file.getId(),
            type,
            url: '', // Optionally, generate a download URL or dataUrl
            name: file.getName(),
            uploadedAt: '', // Optionally, get created date
            size: file.getSize(),
            meta: {}
        };
    }

    async updateAsset(id: string, updateAsset: (asset: Asset) => Asset): Promise<string> {
        // Fetch asset, update, and re-upload
        const asset = await this.getAsset(id);
        if (!asset) return '';
        const updated = updateAsset(asset);
        return this.uploadAsset(updated);
    }

    async updateManyAssets(ids: string[], updateAsset: (asset: Asset) => Asset): Promise<string[]> {
        const results: string[] = [];
        for (const id of ids) {
            const updatedId = await this.updateAsset(id, updateAsset);
            results.push(updatedId);
        }
        return results;
    }
}

// Static utility methods for legacy GAS API compatibility
export class AssetRepositoryImplStatic {
    static convertToBlobFromDataUrl(dataUrl: string, assetName: string, mimeType?: string): GoogleAppsScript.Base.Blob {
        const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
        if (!matches || matches.length !== 3) throw new Error("Invalid data URL format.");
        const base64Data = matches[2];
        const decodedData = Utilities.base64Decode(base64Data);
        return Utilities.newBlob(decodedData, mimeType || matches[1], assetName);
    }
    static uploadAsset(fileName: string, mimeType: string, blob: GoogleAppsScript.Base.Blob): string {
        const file = GoogleDriveService.uploadFile({
            fileName,
            parentFolderId: ASSET_FOLDER_ID,
            mimeType,
            blob
        });
        return file ? file.id || '' : '';
    }
    static deleteAsset(assetId: string): void {
        GoogleDriveService.deleteFilesOrFolders([assetId]);
    }
    static getAssetById(assetId: string): GoogleAppsScript.Drive.File | null {
        const files = GoogleDriveService.findFileByIds({ fileIds: [assetId], parentFolderId: ASSET_FOLDER_ID });
        return files.length > 0 ? files[0] : null;
    }
    static listAssets(): GoogleAppsScript.Drive.File[] {
        // List all files in the asset folder
        const folder = DriveApp.getFolderById(ASSET_FOLDER_ID);
        const fileIterator = folder.getFiles();
        const files: GoogleAppsScript.Drive.File[] = [];
        while (fileIterator.hasNext()) {
            files.push(fileIterator.next());
        }
        return files;
    }
}
