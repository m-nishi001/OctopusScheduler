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

    private saveImage(args: { imageId?: string, imageName: string, data64: string }): { imageId: string } {
        try {
            const blob = Utilities.newBlob(Utilities.base64Decode(args.data64), 'image/png', args.imageName);
            let image: Image;
            let imageId: string;
            if (args.imageId) {
                image = Image.fromEntity(new ImageId(args.imageId), args.imageName, blob);
                this.repository.save(image);
                imageId = args.imageId;
            } else {
                image = Image.createNew(args.imageName, blob);
                this.repository.save(image);
                imageId = image.id.toString();
            }
            return { imageId };
        } catch (e) {
            Logger.log(`[ImageService.saveImage] failed: ${e}`);
            throw e;
        }
    }

    /**
     * 画像メタデータ一覧をJSオブジェクト配列で返却
     */
    private getImageMetadatas(): Array<{ imageId: string; imageName: string; lastUpdatedAt: string }> {
        const images: Image[] = this.repository.findAll();
        return images.map((img: Image) => ({
            imageId: img.id.toString(),
            imageName: img.name,
            lastUpdatedAt: new Date().toISOString() // 必要に応じて修正
        }));
    }

    /**
     * 画像データをbase64文字列で返却
     */
    private getImage(imageId: string): string | null {
        const image: Image | null = this.repository.findById(new ImageId(imageId));
        if (!image) return null;
        // 画像データをbase64で返す
        const blob = image.imageData;
        return Utilities.base64Encode(blob.getBytes());
    }
}
