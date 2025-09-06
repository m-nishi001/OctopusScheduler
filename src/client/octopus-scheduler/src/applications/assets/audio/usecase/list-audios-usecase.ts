import { Audio } from "../../../../domains/assets/audio/entity/audio";
import type { IAudioRepository } from "../../../../domains/assets/audio/repository/audio-repository";

export class ListAudiosUseCase {
  constructor(private readonly audioRepository: IAudioRepository) {}

  async execute(): Promise<Audio[]> {
    return await this.audioRepository.findAll();
  }
}
