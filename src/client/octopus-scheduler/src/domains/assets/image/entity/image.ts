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

    // primary factory
    public static create(imageName: string, data: Blob): Image {
        const newId = new ImageId(crypto.randomUUID());
        return new Image(newId, imageName, data);
    }

    /**
     * DTO/plain object から Image エンティティを復元する
     * @param obj { id: string, name: string, data: Blob }
     * @returns Image
     */
    public static from(obj: unknown): Image {
        if (obj instanceof Image) return obj;
        const plain = obj as Partial<Record<string, unknown>> | undefined;
        const rawId = plain?.imageId ?? plain?.id ?? plain?.imageID;
        const imageId = ImageId.from(rawId as unknown);
        const name = (plain?.imageName ?? plain?.name ?? "") as string;
        const data = (plain?.imageData ?? plain?.data) as Blob;
        return new Image(imageId, name, data as Blob);
    }

    // Compatibility aliases
    public static createNew(imageName: string, data: Blob): Image {
        return Image.create(imageName, data);
    }

    public static reconstruct(id: string, name: string, data: Blob): Image {
        return new Image(new ImageId(id), name, data);
    }

    public static reconstructFromObject(obj: unknown): Image {
        return Image.from(obj);
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