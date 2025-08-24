import { AudioId } from "../vo/audio-id";
import { Audio } from "../entity/audio";
import { AudioMetadata } from "../vo/audio-metadata";

export interface IAudioRepository {
    save(audio: Audio): void;
    findById(id: AudioId): Audio | null;
    findAll(): Audio[];
    findAllMetadatas(): AudioMetadata[];
    delete(id: AudioId): void;
}