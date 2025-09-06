import type { IAudioRepository } from "../../../../domains/assets/audio/repository/audio-repository";

export class SyncAudiosUseCase {
  constructor(private readonly audioRepository: IAudioRepository) {}

  async execute(): Promise<void> {
    // sync logic placeholder
    await this.audioRepository.sync();
  }
}
