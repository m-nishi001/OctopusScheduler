import { AudioRepository } from '../../infrastructures/assets/audio/audio-repository';
import { ImageRepository } from '../../infrastructures/assets/image/image-repository';
import { MovieRepository } from '../../infrastructures/assets/movie/movie-repository';

export class AssetSyncService {
  private audioRepo: AudioRepository;
  private imageRepo: ImageRepository;
  private movieRepo: MovieRepository;

  constructor() {
    this.audioRepo = new AudioRepository();
    this.imageRepo = new ImageRepository();
    this.movieRepo = new MovieRepository();
  }

  async syncAll(): Promise<void> {
    await Promise.all([
      this.audioRepo.sync(),
      this.imageRepo.sync(),
      this.movieRepo.sync(),
    ]);
  }
}
