import { inject, injectable } from "tsyringe";
import { GasService } from "../../gas-service";
import { IImageRepository } from "../../../domain/assets/image/repository/image-repository";
import { ImageId } from "../../../domain/assets/image/vo/image-id";
import { Image } from "../../../domain/assets/image/entity/image";

@injectable()
export class ImageService implements GasService {
    readonly serviceName = "ImageService";
    readonly functions: Record<string, (args: any) => any>;
    private repository: IImageRepository;

    constructor(@inject("IImageRepository") repository: IImageRepository) {
        this.repository = repository;
        this.functions = {
            saveImage: this.saveImage.bind(this),
            getImageMetadatas: this.getImageMetadatas.bind(this),
            getImage: this.getImage.bind(this)
        };
    }

    private async saveImage(args: { imageId: string, imageName: string, data64: string }) {
        try {
            const blob = Utilities.newBlob(Utilities.base64Decode(args.data64), 'image/png', args.imageName);
            const image = Image.fromEntity(new ImageId(args.imageId), args.imageName, blob);
            await this.repository.save(image);
            return { saved: true };
        } catch (e) {
            Logger.log(`[ImageService.saveImage] failed: ${e}`);
            return { saved: false };
        }
    }

    private async getImageMetadatas(): Promise<any[]> {
        const images = await this.repository.findAll();
        return images.map((img: Image) => ({
            imageId: img.id.toString(),
            imageName: img.name,
            lastUpdatedAt: new Date().toISOString() // 必要に応じて修正
        }));
    }

    private async getImage(imageId: string): Promise<string | null> {
        const image = await this.repository.findById(new ImageId(imageId));
        if (!image) return null;
        // 画像データをbase64で返す
        const blob = image.imageData;
        return Utilities.base64Encode(blob.getBytes());
    }
}
