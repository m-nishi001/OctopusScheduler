import { Movie } from "../../../../domains/assets/movie/entity/movie";
import type { IMovieRepository } from "../../../../domains/assets/movie/repository/movie-repository";
import { MovieId } from "../../../../domains/assets/movie/vo/movie-id";

export class GetMovieUseCase {
    constructor(private readonly movieRepository: IMovieRepository) { }

    async execute(id: string): Promise<Movie | null> {
        return await this.movieRepository.findById(MovieId.create(id));
    }
}
