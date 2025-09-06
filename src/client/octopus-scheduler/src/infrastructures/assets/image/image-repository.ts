import { Image } from "../../../domains/assets/image/entity/image";
import type { IImageRepository } from "../../../domains/assets/image/repository/image-repository";
import { ImageId } from "../../../domains/assets/image/vo/image-id";
import { ImageMetadata } from "../../../domains/assets/image/vo/image-metadata";
import { GasFunctionService } from "../../../../../packages/common-lib/src/google-apps-script/gas-script-service.ts";
import { LocalStorageService } from "../../../../../packages/common-lib/src/storage/local-storage-service.ts";
import { StorageConfig } from "../../storage-config";
import { AssetConverter } from "../asset-converter";

export class ImageRepository implements IImageRepository {
    private readonly service;
    private readonly imageDataStorage: LocalStorageService;
    private readonly imageMetadataStorage: LocalStorageService;

    constructor() {
        const apiName = "callOctopusSchedulerApi";
        this.service = GasFunctionService.create(apiName)!;
        this.imageDataStorage = new LocalStorageService(StorageConfig.getDbName(), "ImageData");
        this.imageMetadataStorage = new LocalStorageService(StorageConfig.getDbName(), "ImageMetadataStore");
    }

    public async save(image: Image): Promise<void> {
        try {
            await this.imageDataStorage.save<Image>(image.imageId.toString(), image);
            console.log(`Image with ID ${image.imageId.toString()} saved to local storage.`);

            const base64Data = await AssetConverter.blobToBase64(image.imageData);
            const imageDataToSend = {
                imageId: image.imageId.toString(),
                imageName: image.imageName,
                data64: base64Data
            };
            await this.service
                .createCall<void>("ImageService.saveImage", imageDataToSend)
                .withTimeout(20000)
                .withSuccessed(() => console.log(`Image with ID ${image.imageId.toString()} saved to remote.`))
                .withFailuered(message => {
                    console.error(`Failed to save image to remote:`, message);
                    throw new Error("Failed to save image to remote.");
                })
                .invoke();

        } catch (error) {
            console.error(`Failed to save image with ID ${image.imageId.toString()}:`, error);
            throw new Error("Failed to save image.");
        }
    }

    public async findById(id: ImageId): Promise<Image | null> {
        const image = await this.imageDataStorage.get<Image>(id.toString());
        return image ? Image.from(image) : null;
    }

    public async findAll(): Promise<Image[]> {
        const images = await this.imageDataStorage.getAll<Image>();
        return Array.from(images.values()).map(i => Image.from(i));
    }

    public async delete(id: ImageId): Promise<void> {
        try {
            // Request remote deletion first
            await this.service
                .createCall<void>("ImageService.deleteImage", id.toString())
                .withTimeout(20000)
                .withSuccessed(() => console.log(`Image with ID ${id.toString()} deleted on remote.`))
                .withFailuered(message => {
                    console.error(`Failed to delete image on remote:`, message);
                    throw new Error("Failed to delete image on remote.");
                })
                .invoke();

            // Remove local data and metadata
            await this.imageDataStorage.delete(id.toString());
            await this.imageMetadataStorage.delete(id.toString());
            console.log(`Image with ID ${id.toString()} deleted successfully (remote + local).`);
        } catch (error) {
            console.error(`Failed to delete image with ID ${id.toString()}:`, error);
            throw new Error("Failed to delete image.");
        }
    }

    public async sync(): Promise<void> {
        try {
            const remoteMetadatas = await this.getRemoteMetadatas();
            if (remoteMetadatas.length === 0) {
                console.log("No remote image metadata found. Sync skipped.");
                return;
            }

            const localMetadatas = await this.imageMetadataStorage.getAll<ImageMetadata>();
            const localImageMetadatas = Array.from(localMetadatas.values());

            await this.removeStaleFiles(remoteMetadatas, localImageMetadatas);
            await this.fetchAndUpdateFiles(remoteMetadatas, localImageMetadatas);

        } catch (error) {
            console.error("An error occurred during sync:", error);
            throw new Error("Failed to sync images.");
        }
    }

    private async getRemoteMetadatas(): Promise<ImageMetadata[]> {
        return new Promise<ImageMetadata[]>((resolve, reject) => {
            this.service
                .createCall<{ imageId: string; imageName: string; lastUpdatedAt: Date; }[]>("ImageService.getImageMetadatas")
                .withTimeout(20000)
                .withSuccessed(metadatas => resolve(metadatas))
                .withFailuered(message => {
                    console.error("Failed to get remote image metadata:", message);
                    reject(new Error(message));
                })
                .invoke();
        });
    }

    private async removeStaleFiles(
        remoteMetadatas: ImageMetadata[],
        localMetadatas: ImageMetadata[]
    ): Promise<void> {
        const filesToRemove = localMetadatas
            .filter(localMeta => !remoteMetadatas.some(remoteMeta => remoteMeta.imageId === localMeta.imageId))
            .map(meta => meta.imageId);

        if (filesToRemove.length > 0) {
            console.log("Removing locally-deleted remote files:", filesToRemove);
            await this.imageDataStorage.removeMultiple(filesToRemove);
            await this.imageMetadataStorage.removeMultiple(filesToRemove);
        }
    }

    private async fetchAndUpdateFiles(
        remoteMetadatas: ImageMetadata[],
        localMetadatas: ImageMetadata[]
    ): Promise<void> {
        const filesToUpdate = remoteMetadatas.filter(remoteMeta => {
            const localMeta = localMetadatas.find(local => local.imageId === remoteMeta.imageId);
            return !localMeta || remoteMeta.lastUpdatedAt > localMeta.lastUpdatedAt;
        });

        if (filesToUpdate.length > 0) {
            console.log("Found files to update:", filesToUpdate.map(f => f.imageId));
            const remoteImages: Image[] = [];

            const imagePromises = filesToUpdate.map(meta =>
                this.service
                    .createCall<{ imageId: string; imageName: string; data64: string } | null>("ImageService.getImage", meta.imageId)
                    .withTimeout(20000)
                    .withSuccessed(payload => {
                        if (payload) {
                            const blobData = AssetConverter.base64ToBlob(payload.data64, 'image/png');
                            const image = Image.create(payload.imageName, blobData, ImageId.create(payload.imageId));
                            remoteImages.push(image);
                        } else {
                            console.warn(`ImageService.getImage returned unexpected payload for id=${meta.imageId}`, payload);
                        }
                    })
            );
            await this.service.all(...imagePromises);

            const imagesToSave = new Map<string, Image>(remoteImages.map(image => [image.imageId.toString(), image]));
            await this.imageDataStorage.saveMultiple<Image>(imagesToSave);

            const metadatasToSave = new Map<string, ImageMetadata>(filesToUpdate.map(meta => [meta.imageId, meta]));
            await this.imageMetadataStorage.saveMultiple<ImageMetadata>(metadatasToSave);

            console.log(`Successfully updated ${remoteImages.length} images and their metadata.`);
        } else {
            console.log("No images to update. Local data is up-to-date.");
        }
    }
}