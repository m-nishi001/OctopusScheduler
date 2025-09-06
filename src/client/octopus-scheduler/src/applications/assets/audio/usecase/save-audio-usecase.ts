import { Audio } from "../../../../domains/assets/audio/entity/audio";
import type { IAudioRepository } from "../../../../domains/assets/audio/repository/audio-repository";

export class SaveAudioUseCase {
  constructor(private readonly audioRepository: IAudioRepository) {}

  async execute(audioName: string, data: Blob): Promise<void> {
    const audio = Audio.createNew(audioName, data);
    await this.audioRepository.save(audio);
  }
}
