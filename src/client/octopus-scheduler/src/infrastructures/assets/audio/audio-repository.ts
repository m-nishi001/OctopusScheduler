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
        const apiName = "callOctopusSchedulerApi";
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
        let audioObj = await this.storage.get<any>(id.toString());
        if (!audioObj) {
            console.log(`Audio with ID ${id.toString()} not found locally. Starting sync...`);
            await this.sync();
            audioObj = await this.storage.get<any>(id.toString());
            if (audioObj) {
                console.log(`Audio with ID ${id.toString()} found after sync.`);
            }
        }
        if (!audioObj) return null;
        return Audio.reconstructFromObject(audioObj);
    }

    public async findAll(): Promise<Audio[]> {
        let audioObjs = await this.storage.getAll<any>();
        if (audioObjs.size === 0) {
            console.log("No audios found locally. Starting sync...");
            await this.sync();
            audioObjs = await this.storage.getAll<any>();
            if (audioObjs.size > 0) {
                console.log(`${audioObjs.size} audios found after sync.`);
            }
        }
        // plain object から Audio エンティティへ復元
        const audios: Audio[] = [];
        for (const obj of audioObjs.values()) {
            try {
                audios.push(Audio.reconstructFromObject(obj));
            } catch (e) {
                console.error("Audio復元失敗", e, obj);
            }
        }
        return audios;
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
            await this.storage.delete(id.toString());
            const localMetadataStorage = new LocalStorageService(StorageConfig.getDbName(), this.audioMetadataStoreName);
            await localMetadataStorage.delete(id.toString());
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
        let remoteMetadatas = new Array<AudioMetadata>();
        const metadataCall = this.service.createCall<any>("AudioService.getAudioMetadatas");
        await metadataCall
            .withTimeout(20000)
            .withSuccessed(metadatas => {
                if (metadatas) {
                    // Normalize different API shapes (array or object)
                    remoteMetadatas = AssetConverter.normalizeMetadatas<AudioMetadata>(metadatas);
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
                    .createCall<any>("AudioService.getAudio", meta.audioId)
                    .withTimeout(20000)
                    .withSuccessed(base64Data => {
                        const data64 = AssetConverter.extractBase64Data(base64Data);
                        if (data64) {
                            const blobData = AssetConverter.base64ToBlob(data64, 'audio/mpeg');
                            const audio = Audio.reconstruct(meta.audioId, meta.audioName, blobData);
                            remoteAudios.push(audio);
                        } else {
                            console.warn(`AudioService.getAudio returned unexpected payload for id=${meta.audioId}`, base64Data);
                        }
                    })
            );

            await this.service.all(...audioPromises);

            const audiosToSave = new Map(remoteAudios.map(audio => [audio.id.toString(), audio]));
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