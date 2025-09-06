import type { IImageRepository } from "../../../domains/assets/image/repository/image-repository";
import { ImageRepository } from "../../../infrastructures/assets/image/image-repository";
import { SaveImageUseCase } from "./usecase/save-image-usecase";
import { GetImageUseCase } from "./usecase/get-image-usecase";
import { ListImagesUseCase } from "./usecase/list-images-usecase";
import { DeleteImageUseCase } from "./usecase/delete-image-usecase";
import { SyncImagesUseCase } from "./usecase/sync-images-usecase";
import { Image } from "../../../domains/assets/image/entity/image";

export class ImageService {
    private readonly saveUc: SaveImageUseCase;
    private readonly getUc: GetImageUseCase;
    private readonly listUc: ListImagesUseCase;
    private readonly deleteUc: DeleteImageUseCase;
    private readonly syncUc: SyncImagesUseCase;

    constructor(imageRepository?: IImageRepository) {
        const repo = imageRepository ?? new ImageRepository();
    this.saveUc = new SaveImageUseCase(repo);
    this.getUc = new GetImageUseCase(repo);
    this.listUc = new ListImagesUseCase(repo);
    this.deleteUc = new DeleteImageUseCase(repo);
    this.syncUc = new SyncImagesUseCase(repo);
    }

    public async saveNewImage(imageName: string, data: Blob): Promise<void> {
        try {
            await this.saveUc.execute(imageName, data);
        } catch (error) {
            console.error("Failed to save new image:", error);
            throw new Error("Failed to save new image.");
        }
    }

    public async getImageById(imageId: string): Promise<Image | null> {
        try {
            return await this.getUc.execute(imageId);
        } catch (error) {
            console.error(`Failed to get image with ID ${imageId}:`, error);
            return null;
        }
    }

    public async getAllImages(): Promise<Image[]> {
        try {
            return await this.listUc.execute();
        } catch (error) {
            console.error("Failed to get all images:", error);
            return [];
        }
    }

    public async deleteImage(imageId: string): Promise<void> {
        try {
            await this.deleteUc.execute(imageId);
        } catch (error) {
            console.error(`Failed to delete image with ID ${imageId}:`, error);
            throw new Error("Failed to delete image.");
        }
    }

    public async syncImages(): Promise<void> {
        try {
            await this.syncUc.execute();
            console.log("Images synchronized successfully.");
        } catch (error) {
            console.error("Failed to sync images:", error);
            throw new Error("Failed to sync images.");
        }
    }
}