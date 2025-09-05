import { injectable, inject } from "tsyringe";
import { IImageRepository } from "../../../../domain/assets/image/repository/image-repository";
import { ImageId } from "../../../../domain/assets/image/vo/image-id";

@injectable()
export class RenameImageUseCase {
    constructor(@inject("IImageRepository") private repository: IImageRepository) { }

    execute(imageId: string, newName: string): void {
        const img = this.repository.findById(new ImageId(imageId));
        if (!img) throw new Error(`Image not found: ${imageId}`);
        img.renameImage(newName);
        this.repository.save(img);
    }
}
