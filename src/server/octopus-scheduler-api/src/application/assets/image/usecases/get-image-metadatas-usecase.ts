import { injectable, inject } from "tsyringe";
import { IImageRepository } from "../../../../domain/assets/image/repository/image-repository";
import { ImageMetadata } from "../../../../domain/assets/image/vo/image-metadata";

@injectable()
export class GetImageMetadatasUseCase {
    constructor(@inject("IImageRepository") private repository: IImageRepository) { }

    execute(): ImageMetadata[] {
        return this.repository.findAllMetadatas();
    }
}
