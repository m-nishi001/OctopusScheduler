import { Audio } from "src/domains/assets/audio/entity/audio";
import type { IAudioRepository } from "src/domains/assets/audio/repository/audio-repository";
import { AudioId } from "src/domains/assets/audio/vo/audio-id";
import { AudioRepository } from "src/infrastructures/assets/audio/audio-repository";

/**
 * AudioエンティティのCRUD操作を調整するアプリケーションサービス。
 * ドメイン層とインフラ層を疎結合に保ち、プレゼンテーション層からの要求を処理します。
 */
export class AudioService {
    private readonly audioRepository: IAudioRepository;

    constructor() {
        this.audioRepository = new AudioRepository();
    }

    /**
     * 新しいオーディオを保存する
     * @param audioName オーディオ名
     * @param data Blob形式のオーディオデータ
     */
    public async saveNewAudio(audioName: string, data: Blob): Promise<void> {
        try {
            const audio = Audio.createNew(audioName, data);
            await this.audioRepository.save(audio);
        } catch (error) {
            console.error("Failed to save new audio:", error);
            throw new Error("Failed to save new audio.");
        }
    }

    /**
     * 指定されたIDのオーディオを取得する
     * @param audioId オーディオID
     * @returns Audioエンティティまたはnull
     */
    public async getAudioById(audioId: string): Promise<Audio | null> {
        try {
            const id = new AudioId(audioId);
            return await this.audioRepository.findById(id);
        } catch (error) {
            console.error(`Failed to get audio with ID ${audioId}:`, error);
            return null;
        }
    }

    /**
     * すべてのオーディオを取得する
     * @returns Audioエンティティの配列
     */
    public async getAllAudios(): Promise<Audio[]> {
        try {
            return await this.audioRepository.findAll();
        } catch (error) {
            console.error("Failed to get all audios:", error);
            return [];
        }
    }

    /**
     * 指定されたオーディオを削除する
     * @param audioId 削除するオーディオのID
     */
    public async deleteAudio(audioId: string): Promise<void> {
        try {
            const id = new AudioId(audioId);
            await this.audioRepository.delete(id);
        } catch (error) {
            console.error(`Failed to delete audio with ID ${audioId}:`, error);
            throw new Error("Failed to delete audio.");
        }
    }

    /**
     * ローカルストレージとリモートのオーディオデータを同期する
     */
    public async syncAudios(): Promise<void> {
        try {
            await this.audioRepository.sync();
            console.log("Audios synchronized successfully.");
        } catch (error) {
            console.error("Failed to sync audios:", error);
            throw new Error("Failed to sync audios.");
        }
    }
}