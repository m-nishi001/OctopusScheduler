import { injectable, inject } from "tsyringe";
import { IAudioRepository } from "../../../../domain/assets/audio/repository/audio-repository";
import { AudioMetadata } from "../../../../domain/assets/audio/vo/audio-metadata";

@injectable()
export class GetAudioMetadatasUseCase {
    constructor(@inject("IAudioRepository") private repository: IAudioRepository) { }

    execute(): AudioMetadata[] {
        return this.repository.findAllMetadatas();
    }
}
