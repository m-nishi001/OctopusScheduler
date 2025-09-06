import type { IMovieRepository } from "../../../../domains/assets/movie/repository/movie-repository";
import { MovieId } from "../../../../domains/assets/movie/vo/movie-id";

export class DeleteMovieUseCase {
    constructor(private readonly movieRepository: IMovieRepository) { }

    async execute(id: string): Promise<void> {
        await this.movieRepository.delete(MovieId.create(id));
    }
}
