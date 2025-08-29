
import { Image } from "../../../domain/assets/image/entity/image";
import { IImageRepository } from "../../../domain/assets/image/repository/image-repository";
import { ImageId } from "../../../domain/assets/image/vo/image-id";
import { injectable } from "tsyringe";
import { GoogleDriveService } from "/root/google_apps_script/octopus-scheduler/src/server/shared-packages/src/google-drive-service";

@injectable()
export class ImageRepository implements IImageRepository {

    private static readonly imageFolderId: string = PropertiesService.getScriptProperties().getProperty('octopus-schedule-api-image') ?? (() => { throw new Error('Image folder ID is not set in ScriptProperties.'); })();

    save(image: Image): void {
        const folderId = ImageRepository.imageFolderId;
        let mimeType: string = 'image/png';
        if (image.imageData.getContentType) {
            const mt = image.imageData.getContentType();
            if (mt) mimeType = mt;
        }
        GoogleDriveService.uploadFile({
            fileId: image.id.toString(),
            fileName: image.name,
            parentFolderId: folderId,
            mimeType: mimeType,
            blob: image.imageData
        });
    }

    findById(id: ImageId): Image | null {
        try {
            const file = DriveApp.getFileById(id.toString());
            return Image.fromEntity(new ImageId(file.getId()), file.getName(), file.getBlob());
        } catch (e) {
            return null;
        }
    }

    findAll(): Image[] {
        const folderId = ImageRepository.imageFolderId;
        const files = DriveApp.getFolderById(folderId).getFiles();
        const images: Image[] = [];
        while (files.hasNext()) {
            const file = files.next();
            images.push(Image.fromEntity(new ImageId(file.getId()), file.getName(), file.getBlob()));
        }
        return images;
    }

    delete(id: ImageId): void {
        GoogleDriveService.deleteFilesOrFolders([id.toString()]);
    }
}
