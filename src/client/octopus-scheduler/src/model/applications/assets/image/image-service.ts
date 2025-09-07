import type { IImageRepository } from "../../../domains/assets/image/repository/image-repository";
import { ImageRepository } from "../../../infrastructures/assets/image/image-repository";
import { Image } from "../../../domains/assets/image/entity/image";
import { ImageId } from "../../../domains/assets/image/vo/image-id";

export class ImageService {
    private readonly imageRepository: IImageRepository;

    constructor(imageRepository?: IImageRepository) {
        this.imageRepository = imageRepository ?? new ImageRepository();
    }

    public async saveNewImage(imageName: string, data: Blob): Promise<void> {
        try {
            await this.imageRepository.save(Image.create(imageName, data));
        } catch (error) {
            console.error("Failed to save new image:", error);
            throw new Error("Failed to save new image.");
        }
    }

    public async getImageById(imageId: string): Promise<Image | null> {
        try {
            return await this.imageRepository.findById(ImageId.create(imageId));
        } catch (error) {
            console.error(`Failed to get image with ID ${imageId}:`, error);
            return null;
        }
    }

    public async getAllImages(): Promise<Image[]> {
        try {
            return await this.imageRepository.findAll();
        } catch (error) {
            console.error("Failed to get all images:", error);
            return [];
        }
    }

    public async deleteImage(imageId: string): Promise<void> {
        try {
            await this.imageRepository.delete(ImageId.create(imageId));
        } catch (error) {
            console.error(`Failed to delete image with ID ${imageId}:`, error);
            throw new Error("Failed to delete image.");
        }
    }

    public async syncImages(): Promise<void> {
        try {
            await this.imageRepository.sync();
            console.log("Images synchronized successfully.");
        } catch (error) {
            console.error("Failed to sync images:", error);
            throw new Error("Failed to sync images.");
        }
    }
}