import type { IAudioRepository } from "../../../domains/assets/audio/repository/audio-repository";
import { AudioRepository } from "../../../infrastructures/assets/audio/audio-repository";
import { SaveAudioUseCase } from "./usecase/save-audio-usecase";
import { GetAudioUseCase } from "./usecase/get-audio-usecase";
import { ListAudiosUseCase } from "./usecase/list-audios-usecase";
import { DeleteAudioUseCase } from "./usecase/delete-audio-usecase";
import { SyncAudiosUseCase } from "./usecase/sync-audios-usecase";
import { Audio } from "../../../domains/assets/audio/entity/audio";

export class AudioService {
    private readonly saveUc: SaveAudioUseCase;
    private readonly getUc: GetAudioUseCase;
    private readonly listUc: ListAudiosUseCase;
    private readonly deleteUc: DeleteAudioUseCase;
    private readonly syncUc: SyncAudiosUseCase;

    constructor(audioRepository?: IAudioRepository) {
        const repo = audioRepository ?? new AudioRepository();
        this.saveUc = new SaveAudioUseCase(repo);
        this.getUc = new GetAudioUseCase(repo);
        this.listUc = new ListAudiosUseCase(repo);
        this.deleteUc = new DeleteAudioUseCase(repo);
        this.syncUc = new SyncAudiosUseCase(repo);
    }

    public async saveNewAudio(audioName: string, data: Blob): Promise<void> {
        try {
            await this.saveUc.execute(audioName, data);
        } catch (error) {
            console.error("Failed to save new audio:", error);
            throw new Error("Failed to save new audio.");
        }
    }

    public async getAudioById(audioId: string): Promise<Audio | null> {
        try {
            return await this.getUc.execute(audioId);
        } catch (error) {
            console.error(`Failed to get audio with ID ${audioId}:`, error);
            return null;
        }
    }

    public async getAllAudios(): Promise<Audio[]> {
        try {
            return await this.listUc.execute();
        } catch (error) {
            console.error("Failed to get all audios:", error);
            return [];
        }
    }

    public async deleteAudio(audioId: string): Promise<void> {
        try {
            await this.deleteUc.execute(audioId);
        } catch (error) {
            console.error(`Failed to delete audio with ID ${audioId}:`, error);
            throw new Error("Failed to delete audio.");
        }
    }

    public async syncAudios(): Promise<void> {
        try {
            await this.syncUc.execute();
            console.log("Audios synchronized successfully.");
        } catch (error) {
            console.error("Failed to sync audios:", error);
            throw new Error("Failed to sync audios.");
        }
    }
}