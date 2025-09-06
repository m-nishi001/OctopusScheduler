import { Movie } from "../../../../domains/assets/movie/entity/movie";
import type { IMovieRepository } from "../../../../domains/assets/movie/repository/movie-repository";

export class SaveMovieUseCase {
  constructor(private readonly movieRepository: IMovieRepository) {}

  async execute(movieName: string, data: Blob): Promise<void> {
    const movie = Movie.createNew(movieName, data);
    await this.movieRepository.save(movie);
  }
}
