import { ImageId } from "../vo/image-id";

export class Image {

    private _imageId: ImageId;
    private _imageName: string;
    private _imageData: Blob;

    private constructor(imageId: ImageId, imageName: string, imageData: Blob) {
        this._imageId = imageId;
        this._imageName = imageName;
        this._imageData = imageData;
    }

    public static create(imageName: string, imageData: Blob, imageId: ImageId | null = null): Image {
        return new Image((imageId ?? ImageId.create()), imageName, imageData);
    }

    public static from(another: Image): Image {
        return new Image(ImageId.from(another._imageId), another._imageName, another._imageData);
    }

    public get imageId(): ImageId {
        return this._imageId;
    }

    public get imageName(): string {
        return this._imageName;
    }

    public get imageData(): Blob {
        return this._imageData;
    }

    public renameImage(newName: string): void {
        if (!newName || newName.trim().length === 0) {
            throw new Error("画像名は空にできません。");
        }
        this._imageName = newName;
    }
}