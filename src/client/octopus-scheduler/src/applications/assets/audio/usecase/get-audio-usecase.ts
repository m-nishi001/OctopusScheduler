import { Audio } from "../../../../domains/assets/audio/entity/audio";
import type { IAudioRepository } from "../../../../domains/assets/audio/repository/audio-repository";
import { AudioId } from "../../../../domains/assets/audio/vo/audio-id";

export class GetAudioUseCase {
  constructor(private readonly audioRepository: IAudioRepository) {}

  async execute(id: string): Promise<Audio | null> {
    const audioId = AudioId.create(id);
    return await this.audioRepository.findById(audioId);
  }
}
