import { ImageId } from "../vo/image-id";

export class Image {
    private imageId: ImageId;
    private imageName: string;
    private data: Blob;

    private constructor(imageId: ImageId, imageName: string, data: Blob) {
        this.imageId = imageId;
        this.imageName = imageName;
        this.data = data;
    }

    public static createNew(imageName: string, data: Blob): Image {
        const newId = new ImageId(crypto.randomUUID());
        return new Image(newId, imageName, data);
    }

    public get id(): ImageId {
        return this.imageId;
    }

    public get name(): string {
        return this.imageName;
    }

    public get imageData(): Blob {
        return this.data;
    }

    public renameImage(newName: string): void {
        if (!newName || newName.trim().length === 0) {
            throw new Error("画像名は空にできません。");
        }
        this.imageName = newName;
    }
}