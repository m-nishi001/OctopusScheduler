import type { IImageRepository } from "../../../../domains/assets/image/repository/image-repository";

export class SyncImagesUseCase {
  constructor(private readonly imageRepository: IImageRepository) {}

  async execute(): Promise<void> {
    await this.imageRepository.sync();
  }
}
