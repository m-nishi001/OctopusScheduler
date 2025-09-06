import { Image } from "../../../../domains/assets/image/entity/image";
import type { IImageRepository } from "../../../../domains/assets/image/repository/image-repository";

export class ListImagesUseCase {
  constructor(private readonly imageRepository: IImageRepository) {}

  async execute(): Promise<Image[]> {
    return await this.imageRepository.findAll();
  }
}
