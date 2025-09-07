import { Audio } from "../../../domains/assets/audio/entity/audio";
import type { IAudioRepository } from "../../../domains/assets/audio/repository/audio-repository";
import { AudioId } from "../../../domains/assets/audio/vo/audio-id";
import { AudioMetadata } from "../../../domains/assets/audio/vo/audio-metadata";
import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service.ts";
import { LocalStorageService } from "../../../../../../packages/common-lib/src/storage/local-storage-service.ts";
import { StorageConfig } from "../../storage-config.ts";
import { AssetConverter } from "../asset-converter.ts";

export class AudioRepository implements IAudioRepository {
    private readonly service;
    private readonly audioStorage: LocalStorageService;
    private readonly audioMetadataStorage: LocalStorageService;

    constructor() {
        const apiName = "callOctopusSchedulerApi";
        this.service = GasFunctionService.create(apiName)!;
        this.audioStorage = new LocalStorageService(StorageConfig.getDbName(), "AudioData");
        this.audioMetadataStorage = new LocalStorageService(StorageConfig.getDbName(), "AudioMetadataStore");
    }

    public async save(audio: Audio): Promise<void> {
        try {
            await this.audioStorage.save<Audio>(audio.audioId.toString(), audio);
            console.log(`Audio with ID ${audio.audioId.toString()} saved to local storage.`);

            const base64Data = await AssetConverter.blobToBase64(audio.audioData);
            const audioDataToSend = {
                audioId: audio.audioId.toString(),
                audioName: audio.audioName,
                data64: base64Data
            };
            await this.service
                .createCall<void>("AudioService.saveAudio", audioDataToSend)
                .withTimeout(20000)
                .withSuccessed(() => console.log(`Audio with ID ${audio.audioId.toString()} saved to remote.`))
                .withFailuered(message => {
                    console.error(`Failed to save audio to remote:`, message);
                    throw new Error("Failed to save audio to remote.");
                })
                .invoke();

        } catch (error) {
            console.error(`Failed to save audio with ID ${audio.audioId.toString()}:`, error);
            throw new Error("Failed to save audio.");
        }
    }

    public async findById(id: AudioId): Promise<Audio | null> {
        const audioObj = await this.audioStorage.get<Audio>(id.toString());
        return audioObj ? Audio.from(audioObj) : null;
    }

    public async findAll(): Promise<Audio[]> {
        const audioObjs = await this.audioStorage.getAll<Audio>();
        return (!audioObjs || audioObjs.size === 0)
            ? []
            : Array.from(audioObjs.values()).map(obj => Audio.from(obj));
    }

    public async delete(id: AudioId): Promise<void> {
        try {
            // First request remote deletion
            await this.service
                .createCall<void>("AudioService.deleteAudio", id.toString())
                .withTimeout(20000)
                .withSuccessed(() => console.log(`Audio with ID ${id.toString()} deleted on remote.`))
                .withFailuered(message => {
                    console.error(`Failed to delete audio on remote:`, message);
                    throw new Error("Failed to delete audio on remote.");
                })
                .invoke();

            // On success, remove local data and metadata
            await this.audioStorage.delete(id.toString());
            await this.audioMetadataStorage.delete(id.toString());
            console.log(`Audio with ID ${id.toString()} deleted successfully (remote + local).`);
        } catch (error) {
            console.error(`Failed to delete audio with ID ${id.toString()}:`, error);
            throw new Error("Failed to delete audio.");
        }
    }

    public async sync(): Promise<void> {
        try {

            const remoteMetadatas = await this.getRemoteMetadatas();
            if (remoteMetadatas.length === 0) {
                console.log("No remote audio metadata found. Sync skipped.");
                return;
            }

            const localMetadatasMap = await this.audioMetadataStorage.getAll<AudioMetadata>();
            const localMetadatas = Array.from(localMetadatasMap.values());

            await this.removeStaleFiles(remoteMetadatas, localMetadatas);
            await this.fetchAndUpdateFiles(remoteMetadatas, localMetadatas);

        } catch (error) {
            console.error("An error occurred during sync:", error);
            throw new Error("Failed to sync audios.");
        }
    }

    private async getRemoteMetadatas(): Promise<{ audioId: string; audioName: string; lastUpdatedAt: Date }[]> {
        return new Promise((resolve, reject) => {
            this.service
                .createCall<any>("AudioService.getAudioMetadatas")
                .withTimeout(20000)
                .withSuccessed(metadatas => resolve(metadatas))
                .withFailuered(message => {
                    console.error("Failed to get remote audio metadata:", message);
                    reject(new Error(message));
                })
                .invoke();
        });
    }

    private async removeStaleFiles(
        remoteMetadatas: AudioMetadata[],
        localMetadatas: AudioMetadata[]
    ): Promise<void> {
        const filesToRemove = localMetadatas
            .filter(localMeta => !remoteMetadatas.some(remoteMeta => remoteMeta.audioId === localMeta.audioId))
            .map(meta => meta.audioId);

        if (filesToRemove.length > 0) {
            console.log("Removing locally-deleted remote files:", filesToRemove);
            await this.audioStorage.removeMultiple(filesToRemove);
            await this.audioMetadataStorage.removeMultiple(filesToRemove);
        }
    }

    private async fetchAndUpdateFiles(
        remoteMetadatas: AudioMetadata[],
        localMetadatas: AudioMetadata[]
    ): Promise<void> {
        const filesToUpdate = remoteMetadatas
            .filter(remoteMeta => {
                const localMeta = localMetadatas.find(meta => meta.audioId === remoteMeta.audioId);
                return !localMeta || localMeta.lastUpdatedAt < remoteMeta.lastUpdatedAt;
            });

        if (filesToUpdate.length > 0) {
            console.log("Found files to update:", filesToUpdate.map(f => f.audioId));
            const remoteAudios: Audio[] = [];

            const audioPromises = filesToUpdate.map(meta =>
                this.service
                    .createCall<{ audioId: string; audioName: string; audioData: string } | null>("AudioService.getAudio", meta.audioId)
                    .withTimeout(20000)
                    .withSuccessed(payload => {
                        if (!payload) {
                            console.warn(`Audio with ID ${meta.audioId} not found on remote.`);
                            return;
                        }
                        const blobData = AssetConverter.base64ToBlob(payload.audioData, 'audio/mpeg');
                        const audio = Audio.create(payload.audioName, blobData, AudioId.create(payload.audioId));
                        remoteAudios.push(audio);
                    })
            );
            await this.service.all(...audioPromises);

            const audiosToSave = new Map(remoteAudios.map(audio => [audio.audioId.toString(), audio]));
            await this.audioStorage.saveMultiple<Audio>(audiosToSave);

            const metadatasToSave = new Map<string, AudioMetadata>(filesToUpdate.map(meta => [meta.audioId, meta]));
            await this.audioMetadataStorage.saveMultiple<AudioMetadata>(metadatasToSave);

            console.log(`Successfully updated ${remoteAudios.length} audios and their metadata.`);
        } else {
            console.log("No audios to update. Local data is up-to-date.");
        }
    }
}