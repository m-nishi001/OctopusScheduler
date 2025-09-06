import { Movie } from "../../../../domains/assets/movie/entity/movie";
import type { IMovieRepository } from "../../../../domains/assets/movie/repository/movie-repository";

export class ListMoviesUseCase {
  constructor(private readonly movieRepository: IMovieRepository) {}

  async execute(): Promise<Movie[]> {
    return await this.movieRepository.findAll();
  }
}
