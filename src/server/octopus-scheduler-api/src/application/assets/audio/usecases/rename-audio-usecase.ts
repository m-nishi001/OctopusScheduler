import { injectable, inject } from "tsyringe";
import { IAudioRepository } from "../../../../domain/assets/audio/repository/audio-repository";
import { AudioId } from "../../../../domain/assets/audio/vo/audio-id";

@injectable()
export class RenameAudioUseCase {
    constructor(@inject("IAudioRepository") private repository: IAudioRepository) { }

    execute(audioId: string, newName: string): void {
        const audio = this.repository.findById(new AudioId(audioId));
        if (!audio) throw new Error(`Audio not found: ${audioId}`);
        audio.renameAudio(newName);
        this.repository.save(audio);
    }
}
