import { Audio } from "../../../domains/assets/audio/entity/audio";
import type { IAudioRepository } from "../../../domains/assets/audio/repository/audio-repository";
import { AudioId } from "../../../domains/assets/audio/vo/audio-id";
import { AudioMetadata } from "../../../domains/assets/audio/vo/audio-metadata";
import { GasFunctionService } from "../../../../../packages/common-lib/src/google-apps-script/gas-script-service.ts";
import { LocalStorageService } from "../../../../../packages/common-lib/src/storage/local-storage-service.ts";
import { StorageConfig } from "../../storage-config";
import { AssetConverter } from "../asset-converter";

export class AudioRepository implements IAudioRepository {
    private readonly service;
    private readonly storage: LocalStorageService;
    private readonly audioStoreName = "AudioData";
    private readonly audioMetadataStoreName = "AudioMetadataStore";

    constructor() {
        const apiName = "octopus-scheduler";
        const service = GasFunctionService.create(apiName);
        if (!service) {
            throw new Error(`Failed to create GasFunctionService for API: ${apiName}`);
        }
        this.service = service;
        this.storage = new LocalStorageService(StorageConfig.getDbName(), this.audioStoreName);
    }

    public async save(audio: Audio): Promise<void> {
        try {
            await this.storage.save<Audio>(audio.id.toString(), audio);
            console.log(`Audio with ID ${audio.id.toString()} saved to local storage.`);

            const base64Data = await AssetConverter.blobToBase64(audio.audioData);
            const audioDataToSend = {
                audioId: audio.id.toString(),
                audioName: audio.name,
                data64: base64Data
            };
            await this.service
                .createCall<void>("AudioService.saveAudio", audioDataToSend)
                .withTimeout(20000)
                .withSuccessed(() => console.log(`Audio with ID ${audio.id.toString()} saved to remote.`))
                .withFailuered(message => {
                    console.error(`Failed to save audio to remote:`, message);
                    throw new Error("Failed to save audio to remote.");
                })
                .invoke();

        } catch (error) {
            console.error(`Failed to save audio with ID ${audio.id.toString()}:`, error);
            throw new Error("Failed to save audio.");
        }
    }

    public async findById(id: AudioId): Promise<Audio | null> {
        let audio = await this.storage.get<Audio>(id.toString());
        if (!audio) {
            console.log(`Audio with ID ${id.toString()} not found locally. Starting sync...`);
            await this.sync();
            audio = await this.storage.get<Audio>(id.toString());
            if (audio) {
                console.log(`Audio with ID ${id.toString()} found after sync.`);
            }
        }
        return audio ? Audio.reconstruct(audio.id.toString(), audio.name, audio.audioData) : null;
    }

    public async findAll(): Promise<Audio[]> {
        let audios = await this.storage.getAll<Audio>();
        if (audios.size === 0) {
            console.log("No audios found locally. Starting sync...");
            await this.sync();
            audios = await this.storage.getAll<Audio>();
            if (audios.size > 0) {
                console.log(`${audios.size} audios found after sync.`);
            }
        }
        return Array.from(audios.values()).map(a => Audio.reconstruct(a.id.toString(), a.name, a.audioData));
    }

    public async delete(id: AudioId): Promise<void> {
        try {
            await this.storage.delete(id.toString());
            console.log(`Audio with ID ${id.toString()} deleted successfully.`);
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

            const localMetadatas = await this.getLocalMetadatas();
            const remoteMetadataMap = new Map<string, AudioMetadata>(remoteMetadatas.map(meta => [meta.audioId, meta]));
            const localMetadataMap = new Map<string, AudioMetadata>(Array.from(localMetadatas.values()).map(meta => [meta.audioId, meta]));

            await this.removeStaleFiles(remoteMetadataMap, localMetadataMap);
            await this.fetchAndUpdateFiles(remoteMetadatas, localMetadataMap);
        } catch (error) {
            console.error("An error occurred during sync:", error);
            throw new Error("Failed to sync audios.");
        }
    }

    private async getRemoteMetadatas(): Promise<AudioMetadata[]> {
        let remoteMetadatas = new Array<AudioMetadata>;
        const metadataCall = this.service.createCall<AudioMetadata[]>("AudioService.getAudioMetadatas");
        await metadataCall
            .withTimeout(20000)
            .withSuccessed(metadatas => {
                if (metadatas) {
                    remoteMetadatas = metadatas;
                }
            })
            .withFailuered(message => console.error("Failed to get remote audio metadata:", message))
            .invoke();
        return remoteMetadatas;
    }

    private async getLocalMetadatas(): Promise<Map<string, AudioMetadata>> {
        const localMetadataStorage = new LocalStorageService(StorageConfig.getDbName(), this.audioMetadataStoreName);
        return await localMetadataStorage.getAll<AudioMetadata>();
    }

    private async removeStaleFiles(
        remoteMetadataMap: Map<string, AudioMetadata>,
        localMetadataMap: Map<string, AudioMetadata>
    ): Promise<void> {
        const filesToRemove = Array.from(localMetadataMap.keys())
            .filter(fileId => !remoteMetadataMap.has(fileId));

        if (filesToRemove.length > 0) {
            console.log("Removing locally-deleted remote files:", filesToRemove);
            await this.storage.removeMultiple(filesToRemove);
            const localMetadataStorage = new LocalStorageService(StorageConfig.getDbName(), this.audioMetadataStoreName);
            await localMetadataStorage.removeMultiple(filesToRemove);
        }
    }

    private async fetchAndUpdateFiles(
        remoteMetadatas: AudioMetadata[],
        localMetadataMap: Map<string, AudioMetadata>
    ): Promise<void> {
        const filesToUpdate = remoteMetadatas.filter(remoteMeta => {
            const localMeta = localMetadataMap.get(remoteMeta.audioId);
            return !localMeta || localMeta.lastUpdatedAt < remoteMeta.lastUpdatedAt;
        });

        if (filesToUpdate.length > 0) {
            console.log("Found files to update:", filesToUpdate.map(f => f.audioId));
            const remoteAudios: Audio[] = [];

            const audioPromises = filesToUpdate.map(meta =>
                this.service
                    .createCall<string>("AudioService.getAudio", meta.audioId)
                    .withTimeout(20000)
                    .withSuccessed(base64Data => {
                        if (base64Data) {
                            const blobData = AssetConverter.base64ToBlob(base64Data, 'audio/mpeg');
                            const audio = Audio.reconstruct(meta.audioId, meta.audioName, blobData);
                            remoteAudios.push(audio);
                        }
                    })
            );

            await this.service.all(...audioPromises);

            const audiosToSave = new Map<string, Audio>(remoteAudios.map(audio => [audio.id.toString(), audio]));
            await this.storage.saveMultiple<Audio>(audiosToSave);

            const localMetadataStorage = new LocalStorageService(StorageConfig.getDbName(), this.audioMetadataStoreName);
            const metadatasToSave = new Map<string, AudioMetadata>(filesToUpdate.map(meta => [meta.audioId, meta]));
            await localMetadataStorage.saveMultiple<AudioMetadata>(metadatasToSave);

            console.log(`Successfully updated ${remoteAudios.length} audios and their metadata.`);
        } else {
            console.log("No audios to update. Local data is up-to-date.");
        }
    }
}