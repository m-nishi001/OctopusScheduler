import { Audio } from "../../../domain/assets/audio/entity/audio";
import { IAudioRepository } from "../../../domain/assets/audio/repository/audio-repository";
import { AudioId } from "../../../domain/assets/audio/vo/audio-id";
import { injectable } from "tsyringe";
import { GoogleDriveService } from "/root/google_apps_script/octopus-scheduler/src/server/shared-packages/src/google-drive-service";
import { AudioMetadata } from "../../../domain/assets/audio/vo/audio-metadata";

@injectable()
export class AudioRepository implements IAudioRepository {

    private static readonly audioFolderId: string = PropertiesService.getScriptProperties().getProperty('octopus-schedule-api-audio') ?? (() => { throw new Error('Audio folder ID is not set in ScriptProperties.'); })();

    save(audio: Audio): void {
        const folderId = AudioRepository.audioFolderId;
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
        try {
            const file = DriveApp.getFileById(id.toString());
            return new Audio(new AudioId(file.getId()), file.getName(), file.getBlob());
        } catch (e) {
            return null;
        }
    }

    findAll(): Audio[] {
        const folderId = AudioRepository.audioFolderId;
        const files = DriveApp.getFolderById(folderId).getFiles();
        const audios: Audio[] = [];
        while (files.hasNext()) {
            const file = files.next();
            audios.push(new Audio(new AudioId(file.getId()), file.getName(), file.getBlob()));
        }
        return audios;
    }

    findAllMetadatas(): AudioMetadata[] {
        const folderId = AudioRepository.audioFolderId;
        const files = DriveApp.getFolderById(folderId).getFiles();
        const metadatas: AudioMetadata[] = [];
        while (files.hasNext()) {
            const file = files.next();
            const lastUpdated = file.getLastUpdated();
            metadatas.push(new AudioMetadata(
                file.getId(),
                file.getName(),
                new Date(typeof lastUpdated === 'string' ? Date.parse(lastUpdated) : lastUpdated.valueOf())
            ));
        }
        return metadatas;
    }

    delete(id: AudioId): void {
        GoogleDriveService.deleteFilesOrFolders([id.toString()]);
    }
}