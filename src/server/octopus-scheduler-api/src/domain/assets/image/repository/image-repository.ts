import type { ImageId } from "../vo/image-id";
import { Image } from "../entity/image";

import { ImageMetadata } from "../vo/image-metadata";

export interface IImageRepository {
    save(image: Image): void;
    findById(id: ImageId): Image | null;
    findAll(): Image[];
    findAllMetadatas(): ImageMetadata[];
    delete(id: ImageId): void;
}