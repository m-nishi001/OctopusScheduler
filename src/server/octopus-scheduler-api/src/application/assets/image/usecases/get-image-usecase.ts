import { injectable, inject } from "tsyringe";
import { IImageRepository } from "../../../../domain/assets/image/repository/image-repository";
import { Image } from "../../../../domain/assets/image/entity/image";
import { ImageId } from "../../../../domain/assets/image/vo/image-id";

@injectable()
export class GetImageUseCase {
    constructor(@inject("IImageRepository") private repository: IImageRepository) { }

    execute(imageId: string): Image | null {
        return this.repository.findById(new ImageId(imageId));
    }
}
