import { injectable, inject } from "tsyringe";
import { IMovieRepository } from "../../../../domain/assets/movie/repository/movie-repository";
import { MovieId } from "../../../../domain/assets/movie/vo/movie-id";

@injectable()
export class DeleteMovieUseCase {
    constructor(@inject("IMovieRepository") private repository: IMovieRepository) { }

    execute(movieId: string): void {
        this.repository.delete(new MovieId(movieId));
    }
}
