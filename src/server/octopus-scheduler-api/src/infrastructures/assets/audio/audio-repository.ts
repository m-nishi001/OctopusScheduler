import { Audio } from "../../../domain/assets/audio/entity/audio";
import { IAudioRepository } from "../../../domain/assets/audio/repository/audio-repository";
import { AudioId } from "../../../domain/assets/audio/vo/audio-id";
import { injectable } from "tsyringe";
import { GoogleDriveService } from "/root/google_apps_script/octopus-scheduler/src/server/shared-packages/src/google-drive-service";
import { AudioMetadata } from "../../../domain/assets/audio/vo/audio-metadata";

@injectable()
export class AudioRepository implements IAudioRepository {
    private folderName = "AudioAssets"; // オーディオファイルを保存するGoogle Driveのフォルダ名

    private getAudioFolderId(): string {
        const rootFolder = DriveApp.getRootFolder();
        let folder = rootFolder.getFoldersByName(this.folderName).next();
        if (!folder) {
            folder = rootFolder.createFolder(this.folderName);
        }
        return folder.getId();
    }

    save(audio: Audio): void {
        const folderId = this.getAudioFolderId();
        const mimeType = audio.audioData.getContentType() || 'audio/mpeg';

        GoogleDriveService.uploadFile({
            fileId: audio.id?.toString(),
            fileName: audio.name,
            parentFolderId: folderId,
            mimeType: mimeType,
            blob: audio.audioData
        });
    }

    findById(id: AudioId): Audio | null {
        const folderId = this.getAudioFolderId();
        const files = GoogleDriveService.findFileByIds({ fileIds: [id.toString()], parentFolderId: folderId });

        if (files.length > 0) {
            const file = files[0];
            return new Audio(new AudioId(file.getId()), file.getName(), file.getBlob());
        }

        return null;
    }

    findAll(): Audio[] {
        const folderId = this.getAudioFolderId();
        const files = DriveApp.getFolderById(folderId).getFiles();
        const audios: Audio[] = [];
        while (files.hasNext()) {
            const file = files.next();
            audios.push(new Audio(new AudioId(file.getId()), file.getName(), file.getBlob()));
        }
        return audios;
    }

    findAllMetadatas(): AudioMetadata[] {
        const folderId = this.getAudioFolderId();
        const files = DriveApp.getFolderById(folderId).getFiles();
        const metadatas: AudioMetadata[] = [];
        while (files.hasNext()) {
            const file = files.next();
            metadatas.push(new AudioMetadata(file.getId(), file.getName(), file.getLastUpdated() as Date));
        }
        return metadatas;
    }

    delete(id: AudioId): void {
        GoogleDriveService.deleteFilesOrFolders([id.toString()]);
    }
}