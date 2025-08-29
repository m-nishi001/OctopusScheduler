import type { ImageId } from "../vo/image-id";
import { Image } from "../entity/image";

export interface IImageRepository {
    save(image: Image): void;
    findById(id: ImageId): Image | null;
    findAll(): Image[];
    delete(id: ImageId): void;
}