import { injectable, inject } from "tsyringe";
import { IImageRepository } from "../../../../domain/assets/image/repository/image-repository";
import { Image } from "../../../../domain/assets/image/entity/image";
import { ImageId } from "../../../../domain/assets/image/vo/image-id";

@injectable()
export class SaveImageUseCase {
    constructor(@inject("IImageRepository") private repository: IImageRepository) { }

    execute(args: { imageId?: string; imageName: string; data: GoogleAppsScript.Base.Blob }): string {
        if (args.imageId) {
            const image = Image.fromEntity(new ImageId(args.imageId), args.imageName, args.data);
            this.repository.save(image);
            return args.imageId;
        }
        const image = Image.createNew(args.imageName, args.data);
        this.repository.save(image);
        return image.id.toString();
    }
}
