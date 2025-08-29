
import { ImageId } from "../vo/image-id";

export class Image {
    private imageId: ImageId;
    private imageName: string;
    private data: GoogleAppsScript.Base.Blob;

    constructor(imageId: ImageId, imageName: string, data: GoogleAppsScript.Base.Blob) {
        this.imageId = imageId;
        this.imageName = imageName;
        this.data = data;
    }

    public static createNew(imageName: string, data: GoogleAppsScript.Base.Blob): Image {
        const newId = new ImageId(Utilities.getUuid ? Utilities.getUuid() : (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)));
        return new Image(newId, imageName, data);
    }

    public static fromEntity(imageId: ImageId, imageName: string, data: GoogleAppsScript.Base.Blob): Image {
        return new Image(imageId, imageName, data);
    }

    public get id(): ImageId {
        return this.imageId;
    }

    public get name(): string {
        return this.imageName;
    }

    public get imageData(): GoogleAppsScript.Base.Blob {
        return this.data;
    }

    public renameImage(newName: string): void {
        if (!newName || newName.trim().length === 0) {
            throw new Error("画像名は空にできません。");
        }
        this.imageName = newName;
    }
}