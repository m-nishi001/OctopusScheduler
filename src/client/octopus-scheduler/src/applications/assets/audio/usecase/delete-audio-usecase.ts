import type { IAudioRepository } from "../../../../domains/assets/audio/repository/audio-repository";
import { AudioId } from "../../../../domains/assets/audio/vo/audio-id";

export class DeleteAudioUseCase {
  constructor(private readonly audioRepository: IAudioRepository) {}

  async execute(id: string): Promise<void> {
    const audioId = new AudioId(id);
    await this.audioRepository.delete(audioId);
  }
}
