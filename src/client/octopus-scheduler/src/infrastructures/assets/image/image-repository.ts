import { Image } from "src/domains/assets/image/entity/image";
import type { IImageRepository } from "src/domains/assets/image/repository/image-repository";
import { ImageId } from "src/domains/assets/image/vo/image-id";
import { ImageMetadata } from "src/domains/assets/image/vo/image-metadata";
import { GasFunctionService } from "/root/google_apps_script/octopus-scheduler/src/client/packages/common-lib/src/google-apps-script/gas-script-service.ts";
import { LocalStorageService } from "/root/google_apps_script/octopus-scheduler/src/client/packages/common-lib/src/storage/local-storage-service.ts";
import { StorageConfig } from "src/infrastructures/storage-config";
import { AssetConverter } from "../asset-converter";

export class ImageRepository implements IImageRepository {
    private readonly service;
    private readonly storage: LocalStorageService;
    private readonly imageStoreName = "ImageData";
    private readonly imageMetadataStoreName = "ImageMetadataStore";

    constructor() {
        const apiName = "octopus-scheduler";
        const service = GasFunctionService.create(apiName);
        if (!service) {
            throw new Error(`Failed to create GasFunctionService for API: ${apiName}`);
        }
        this.service = service;
        this.storage = new LocalStorageService(StorageConfig.getDbName(), this.imageStoreName);
    }

    public async save(image: Image): Promise<void> {
        try {
            await this.storage.save<Image>(image.id.toString(), image);
            console.log(`Image with ID ${image.id.toString()} saved to local storage.`);

            const base64Data = await AssetConverter.blobToBase64(image.imageData);
            const imageDataToSend = {
                imageId: image.id.toString(),
                imageName: image.name,
                data64: base64Data
            };
            await this.service
                .createCall<void>("ImageService.saveImage", imageDataToSend)
                .withTimeout(20000)
                .withSuccessed(() => console.log(`Image with ID ${image.id.toString()} saved to remote.`))
                .withFailuered(message => {
                    console.error(`Failed to save image to remote:`, message);
                    throw new Error("Failed to save image to remote.");
                })
                .invoke();

        } catch (error) {
            console.error(`Failed to save image with ID ${image.id.toString()}:`, error);
            throw new Error("Failed to save image.");
        }
    }

    public async findById(id: ImageId): Promise<Image | null> {
        let image = await this.storage.get<Image>(id.toString());

        if (!image) {
            console.log(`Image with ID ${id.toString()} not found locally. Starting sync...`);
            await this.sync();
            image = await this.storage.get<Image>(id.toString());
            if (image) {
                console.log(`Image with ID ${id.toString()} found after sync.`);
            }
        }

        return image ? Image.reconstruct(image.id.toString(), image.name, image.imageData) : null;
    }

    public async findAll(): Promise<Image[]> {
        let images = await this.storage.getAll<Image>();

        if (images.size === 0) {
            console.log("No images found locally. Starting sync...");
            await this.sync();
            images = await this.storage.getAll<Image>();
            if (images.size > 0) {
                console.log(`${images.size} images found after sync.`);
            }
        }
        return Array.from(images.values()).map(i => Image.reconstruct(i.id.toString(), i.name, i.imageData));
    }

    public async delete(id: ImageId): Promise<void> {
        try {
            await this.storage.delete(id.toString());
            console.log(`Image with ID ${id.toString()} deleted successfully.`);
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

            const localMetadatas = await this.getLocalMetadatas();
            const remoteMetadataMap = new Map<string, ImageMetadata>(remoteMetadatas.map(meta => [meta.imageId, meta]));
            const localMetadataMap = new Map<string, ImageMetadata>(Array.from(localMetadatas.values()).map(meta => [meta.imageId, meta]));

            await this.removeStaleFiles(remoteMetadataMap, localMetadataMap);
            await this.fetchAndUpdateFiles(remoteMetadatas, localMetadataMap);
        } catch (error) {
            console.error("An error occurred during sync:", error);
            throw new Error("Failed to sync images.");
        }
    }

    private async getRemoteMetadatas(): Promise<ImageMetadata[]> {
        let remoteMetadatas = new Array<ImageMetadata>;
        const metadataCall = this.service.createCall<ImageMetadata[]>("ImageService.getImageMetadatas");
        await metadataCall
            .withTimeout(20000)
            .withSuccessed(metadatas => {
                if (metadatas) {
                    remoteMetadatas = metadatas;
                }
            })
            .withFailuered(message => console.error("Failed to get remote image metadata:", message))
            .invoke();
        return remoteMetadatas;
    }

    private async getLocalMetadatas(): Promise<Map<string, ImageMetadata>> {
        const localMetadataStorage = new LocalStorageService(StorageConfig.getDbName(), this.imageMetadataStoreName);
        return await localMetadataStorage.getAll<ImageMetadata>();
    }

    private async removeStaleFiles(
        remoteMetadataMap: Map<string, ImageMetadata>,
        localMetadataMap: Map<string, ImageMetadata>
    ): Promise<void> {
        const filesToRemove = Array.from(localMetadataMap.keys())
            .filter(fileId => !remoteMetadataMap.has(fileId));

        if (filesToRemove.length > 0) {
            console.log("Removing locally-deleted remote files:", filesToRemove);
            await this.storage.removeMultiple(filesToRemove);
            const localMetadataStorage = new LocalStorageService(StorageConfig.getDbName(), this.imageMetadataStoreName);
            await localMetadataStorage.removeMultiple(filesToRemove);
        }
    }

    private async fetchAndUpdateFiles(
        remoteMetadatas: ImageMetadata[],
        localMetadataMap: Map<string, ImageMetadata>
    ): Promise<void> {
        const filesToUpdate = remoteMetadatas.filter(remoteMeta => {
            const localMeta = localMetadataMap.get(remoteMeta.imageId);
            return !localMeta || localMeta.lastUpdatedAt < remoteMeta.lastUpdatedAt;
        });

        if (filesToUpdate.length > 0) {
            console.log("Found files to update:", filesToUpdate.map(f => f.imageId));
            const remoteImages: Image[] = [];

            const imagePromises = filesToUpdate.map(meta =>
                this.service
                    .createCall<string>("ImageService.getImage", meta.imageId)
                    .withTimeout(20000)
                    .withSuccessed(base64Data => {
                        if (base64Data) {
                            const blobData = AssetConverter.base64ToBlob(base64Data, 'image/png');
                            const image = Image.reconstruct(meta.imageId, meta.imageName, blobData);
                            remoteImages.push(image);
                        }
                    })
            );

            await this.service.all(...imagePromises);

            const imagesToSave = new Map<string, Image>(remoteImages.map(image => [image.id.toString(), image]));
            await this.storage.saveMultiple<Image>(imagesToSave);

            const localMetadataStorage = new LocalStorageService(StorageConfig.getDbName(), this.imageMetadataStoreName);
            const metadatasToSave = new Map<string, ImageMetadata>(filesToUpdate.map(meta => [meta.imageId, meta]));
            await localMetadataStorage.saveMultiple<ImageMetadata>(metadatasToSave);

            console.log(`Successfully updated ${remoteImages.length} images and their metadata.`);
        } else {
            console.log("No images to update. Local data is up-to-date.");
        }
    }
}