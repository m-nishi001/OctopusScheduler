import { injectable, inject } from "tsyringe";
import { IAudioRepository } from "../../../../domain/assets/audio/repository/audio-repository";
import { Audio } from "../../../../domain/assets/audio/entity/audio";
import { AudioId } from "../../../../domain/assets/audio/vo/audio-id";

@injectable()
export class GetAudioUseCase {
    constructor(@inject("IAudioRepository") private repository: IAudioRepository) { }

    execute(audioId: string): Audio | null {
        return this.repository.findById(new AudioId(audioId));
    }
}
