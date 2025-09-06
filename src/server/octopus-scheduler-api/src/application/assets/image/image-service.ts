import { inject, injectable } from "tsyringe";
import { GasService } from "../../gas-service";
import { GetImageUseCase } from "./usecases/get-image-usecase";
import { SaveImageUseCase } from "./usecases/save-image-usecase";
import { GetImageMetadatasUseCase } from "./usecases/get-image-metadatas-usecase";
import { RenameImageUseCase } from "./usecases/rename-image-usecase";
import { DeleteImageUseCase } from "./usecases/delete-image-usecase";

@injectable()
export class ImageService implements GasService {
    readonly serviceName = "ImageService";
    readonly functions: Record<string, (args: any) => any>;
    private saveImageUseCase: SaveImageUseCase;
    private getImageUseCase: GetImageUseCase;
    private getImageMetadatasUseCase: GetImageMetadatasUseCase;
    private renameImageUseCase: RenameImageUseCase;
    private deleteImageUseCase: DeleteImageUseCase;

    constructor(
        @inject(SaveImageUseCase) saveImageUseCase: SaveImageUseCase,
        @inject(GetImageUseCase) getImageUseCase: GetImageUseCase,
        @inject(GetImageMetadatasUseCase) getImageMetadatasUseCase: GetImageMetadatasUseCase,
        @inject(RenameImageUseCase) renameImageUseCase: RenameImageUseCase,
        @inject(DeleteImageUseCase) deleteImageUseCase: DeleteImageUseCase
    ) {
        this.saveImageUseCase = saveImageUseCase;
        this.getImageUseCase = getImageUseCase;
        this.getImageMetadatasUseCase = getImageMetadatasUseCase;
        this.renameImageUseCase = renameImageUseCase;
        this.deleteImageUseCase = deleteImageUseCase;
        this.functions = {
            saveImage: this.saveImage.bind(this),
            getImageMetadatas: this.getImageMetadatas.bind(this),
            getImage: this.getImage.bind(this),
            renameImage: this.renameImage.bind(this),
            deleteImage: this.deleteImage.bind(this)
        };
    }

    private saveImage(args: { imageId?: string, imageName: string, data64: string }): { imageId: string } {
        const blob = Utilities.newBlob(Utilities.base64Decode(args.data64), 'image/png', args.imageName);
        const imageId = this.saveImageUseCase.execute({ imageId: args.imageId, imageName: args.imageName, data: blob });
        return { imageId };
    }

    private getImageMetadatas(): { imageId: string; imageName: string; lastUpdatedAt: Date }[] {
        const metas = this.getImageMetadatasUseCase.execute();
        return metas.map(meta => ({ imageId: meta.imageId, imageName: meta.imageName, lastUpdatedAt: meta.lastUpdatedAt }));
    }

    private getImage(imageId: string): { imageId: string; imageName: string; data64: string } | null {
        const image = this.getImageUseCase.execute(imageId);
        return image
            ? {
                imageId: image.id.toString(),
                imageName: image.name,
                data64: Utilities.base64Encode(image.imageData.getBytes())
            }
            : null;
    }

    private renameImage(args: { imageId: string; newName: string }): { imageId: string } {
        this.renameImageUseCase.execute(args.imageId, args.newName);
        return { imageId: args.imageId };
    }

    private deleteImage(imageId: string): { imageId: string } {
        this.deleteImageUseCase.execute(imageId);
        return { imageId };
    }
}
