import { injectable, inject } from "tsyringe";
import { IAudioRepository } from "../../../../domain/assets/audio/repository/audio-repository";
import { Audio } from "../../../../domain/assets/audio/entity/audio";
import { AudioId } from "../../../../domain/assets/audio/vo/audio-id";

@injectable()
export class SaveAudioUseCase {
    constructor(@inject("IAudioRepository") private repository: IAudioRepository) { }

    execute(args: { audioId?: string; audioName: string; data: GoogleAppsScript.Base.Blob }): string {
        if (args.audioId) {
            const audio = new Audio(new AudioId(args.audioId), args.audioName, args.data);
            this.repository.save(audio);
            return args.audioId;
        }
        const audio = Audio.createNew(args.audioName, args.data);
        this.repository.save(audio);
        return audio.id.toString();
    }
}
