import type { IAudioRepository } from "../../../domains/assets/audio/repository/audio-repository";
import { AudioRepository } from "../../../infrastructures/assets/audio/audio-repository";
import { Audio } from "../../../domains/assets/audio/entity/audio";
import { AudioId } from "../../../domains/assets/audio/vo/audio-id";

export class AudioService {
    private readonly audioRepository: IAudioRepository;

    constructor(audioRepository?: IAudioRepository) {
        this.audioRepository = audioRepository ?? new AudioRepository();
    }

    public async addNewAudio(audioName: string, data: Blob): Promise<void> {
        try {
            await this.audioRepository.save(Audio.create(audioName, data));
        } catch (error) {
            console.error("Failed to save new audio:", error);
            throw new Error("Failed to save new audio.");
        }
    }

    public async getAudioById(audioId: string): Promise<Audio | null> {
        try {
            return await this.audioRepository.findById(AudioId.create(audioId));
        } catch (error) {
            console.error(`Failed to get audio with ID ${audioId}:`, error);
            return null;
        }
    }

    public async getAllAudios(): Promise<Audio[]> {
        try {
            return await this.audioRepository.findAll();
        } catch (error) {
            console.error("Failed to get all audios:", error);
            return [];
        }
    }

    public async deleteAudio(audioId: string): Promise<void> {
        try {
            await this.audioRepository.delete(AudioId.create(audioId));
        } catch (error) {
            console.error(`Failed to delete audio with ID ${audioId}:`, error);
            throw new Error("Failed to delete audio.");
        }
    }

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