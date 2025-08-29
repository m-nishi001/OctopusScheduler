
import { Image } from "../../../domain/assets/image/entity/image";
import { IImageRepository } from "../../../domain/assets/image/repository/image-repository";
import { ImageId } from "../../../domain/assets/image/vo/image-id";
import { injectable } from "tsyringe";
import { GoogleDriveService } from "/root/google_apps_script/octopus-scheduler/src/server/shared-packages/src/google-drive-service";

@injectable()
export class ImageRepository implements IImageRepository {
    private folderName = "ImageAssets"; // 画像ファイルを保存するGoogle Driveのフォルダ名

    private getImageFolderId(): string {
        const rootFolder = DriveApp.getRootFolder();
        const folders = rootFolder.getFoldersByName(this.folderName);
        let folder = folders.hasNext() ? folders.next() : rootFolder.createFolder(this.folderName);
        return folder.getId();
    }

    async save(image: Image): Promise<void> {
        const folderId = this.getImageFolderId();
        let mimeType: string = 'image/png';
        if (image.imageData.getContentType) {
            const mt = image.imageData.getContentType();
            if (mt) mimeType = mt;
        }
        await GoogleDriveService.uploadFile({
            fileId: image.id.toString(),
            fileName: image.name,
            parentFolderId: folderId,
            mimeType: mimeType,
            blob: image.imageData
        });
    }

    async findById(id: ImageId): Promise<Image | null> {
        const folderId = this.getImageFolderId();
        const files = await GoogleDriveService.findFileByIds({ fileIds: [id.toString()], parentFolderId: folderId });
        if (files.length > 0) {
            const file = files[0];
            return Image.fromEntity(new ImageId(file.getId()), file.getName(), file.getBlob());
        }
        return null;
    }

    async findAll(): Promise<Image[]> {
        const folderId = this.getImageFolderId();
        const files = DriveApp.getFolderById(folderId).getFiles();
        const images: Image[] = [];
        while (files.hasNext()) {
            const file = files.next();
            images.push(Image.fromEntity(new ImageId(file.getId()), file.getName(), file.getBlob()));
        }
        return images;
    }

    async delete(id: ImageId): Promise<void> {
        await GoogleDriveService.deleteFilesOrFolders([id.toString()]);
    }
}
