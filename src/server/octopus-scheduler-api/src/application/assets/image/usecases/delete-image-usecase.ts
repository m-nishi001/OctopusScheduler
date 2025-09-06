import { injectable, inject } from "tsyringe";
import { IImageRepository } from "../../../../domain/assets/image/repository/image-repository";
import { ImageId } from "../../../../domain/assets/image/vo/image-id";

@injectable()
export class DeleteImageUseCase {
    constructor(@inject("IImageRepository") private repository: IImageRepository) { }

    execute(imageId: string): void {
        this.repository.delete(new ImageId(imageId));
    }
}
