import { injectable, inject } from "tsyringe";
import { IAudioRepository } from "../../../../domain/assets/audio/repository/audio-repository";

@injectable()
export class GetAudioMetadatasUseCase {
    constructor(@inject("IAudioRepository") private repository: IAudioRepository) { }

    execute(): { audioId: string; audioName: string; lastUpdatedAt: Date }[] {
        return this.repository.findAllMetadatas();
    }
}
