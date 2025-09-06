import { Image } from "../../../../domains/assets/image/entity/image";
import type { IImageRepository } from "../../../../domains/assets/image/repository/image-repository";

export class SaveImageUseCase {
  constructor(private readonly imageRepository: IImageRepository) {}

  async execute(imageName: string, data: Blob): Promise<void> {
    const image = Image.createNew(imageName, data);
    await this.imageRepository.save(image);
  }
}
