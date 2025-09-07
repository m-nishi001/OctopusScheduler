import { AudioId } from "../vo/audio-id";
import { Audio } from "../entity/audio";

export interface IAudioRepository {
    save(audio: Audio): Promise<void>;
    findById(id: AudioId): Promise<Audio | null>;
    findAll(): Promise<Audio[]>;
    delete(id: AudioId): Promise<void>;
    sync(): Promise<void>;
}