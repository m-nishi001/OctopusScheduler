import { Image } from "src/domains/assets/image/entity/image";
import type { IImageRepository } from "src/domains/assets/image/repository/image-repository";
import { ImageId } from "src/domains/assets/image/vo/image-id";
import { ImageRepository } from "src/infrastructures/assets/image/image-repository";

/**
 * ImageエンティティのCRUD操作を調整するアプリケーションサービス。
 * ドメイン層とインフラ層を疎結合に保ち、プレゼンテーション層からの要求を処理します。
 */
export class ImageService {
    private readonly imageRepository: IImageRepository;

    constructor() {
        this.imageRepository = new ImageRepository();
    }

    /**
     * 新しい画像を保存する
     * @param imageName 画像名
     * @param data Blob形式の画像データ
     */
    public async saveNewImage(imageName: string, data: Blob): Promise<void> {
        try {
            const image = Image.createNew(imageName, data);
            await this.imageRepository.save(image);
        } catch (error) {
            console.error("Failed to save new image:", error);
            throw new Error("Failed to save new image.");
        }
    }

    /**
     * 指定されたIDの画像を取得する
     * @param imageId 画像ID
     * @returns Imageエンティティまたはnull
     */
    public async getImageById(imageId: string): Promise<Image | null> {
        try {
            const id = new ImageId(imageId);
            return await this.imageRepository.findById(id);
        } catch (error) {
            console.error(`Failed to get image with ID ${imageId}:`, error);
            return null;
        }
    }

    /**
     * すべての画像を取得する
     * @returns Imageエンティティの配列
     */
    public async getAllImages(): Promise<Image[]> {
        try {
            return await this.imageRepository.findAll();
        } catch (error) {
            console.error("Failed to get all images:", error);
            return [];
        }
    }

    /**
     * 指定された画像を削除する
     * @param imageId 削除する画像のID
     */
    public async deleteImage(imageId: string): Promise<void> {
        try {
            const id = new ImageId(imageId);
            await this.imageRepository.delete(id);
        } catch (error) {
            console.error(`Failed to delete image with ID ${imageId}:`, error);
            throw new Error("Failed to delete image.");
        }
    }

    /**
     * ローカルストレージとリモートの画像データを同期する
     */
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