import type { ImageId } from "../vo/image-id";
import { Image } from "../entity/image";

export interface IImageRepository {
    save(image: Image): Promise<void>;
    findById(id: ImageId): Promise<Image | null>;
    findAll(): Promise<Image[]>;
    delete(id: ImageId): Promise<void>;
    sync(): Promise<void>;
}