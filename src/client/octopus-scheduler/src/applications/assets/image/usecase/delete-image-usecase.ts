import type { IImageRepository } from "../../../../domains/assets/image/repository/image-repository";
import { ImageId } from "../../../../domains/assets/image/vo/image-id";

export class DeleteImageUseCase {
  constructor(private readonly imageRepository: IImageRepository) {}

  async execute(id: string): Promise<void> {
    await this.imageRepository.delete(ImageId.create(id));
  }
}
