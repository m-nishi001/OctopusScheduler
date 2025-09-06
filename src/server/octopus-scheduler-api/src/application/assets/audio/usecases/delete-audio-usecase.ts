import { injectable, inject } from "tsyringe";
import { IAudioRepository } from "../../../../domain/assets/audio/repository/audio-repository";
import { AudioId } from "../../../../domain/assets/audio/vo/audio-id";

@injectable()
export class DeleteAudioUseCase {
    constructor(@inject("IAudioRepository") private repository: IAudioRepository) { }

    execute(audioId: string): void {
        this.repository.delete(new AudioId(audioId));
    }
}
