import type { IAudioRepository } from "../../domains/assets/audio/repository/audio-repository";
import type { IImageRepository } from "../../domains/assets/image/repository/image-repository";
import type { IMovieRepository } from "../../domains/assets/movie/repository/movie-repository";
import { AudioRepository } from '../../infrastructures/assets/audio/audio-repository';
import { ImageRepository } from '../../infrastructures/assets/image/image-repository';
import { MovieRepository } from '../../infrastructures/assets/movie/movie-repository';

export class AssetSyncService {
  constructor(
    private readonly audioRepo: IAudioRepository = new AudioRepository(),
    private readonly imageRepo: IImageRepository = new ImageRepository(),
    private readonly movieRepo: IMovieRepository = new MovieRepository(),
  ) {}

  async syncAll(): Promise<void> {
    await Promise.all([
      this.audioRepo.sync(),
      this.imageRepo.sync(),
      this.movieRepo.sync(),
    ]);
  }
}
