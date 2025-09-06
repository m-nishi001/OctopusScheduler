import { Image } from "../../../../domains/assets/image/entity/image";
import type { IImageRepository } from "../../../../domains/assets/image/repository/image-repository";
import { ImageId } from "../../../../domains/assets/image/vo/image-id";

export class GetImageUseCase {
  constructor(private readonly imageRepository: IImageRepository) {}

  async execute(id: string): Promise<Image | null> {
    const imageId = new ImageId(id);
    return await this.imageRepository.findById(imageId);
  }
}
